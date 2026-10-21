'use server'

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getOrgId, getSessionUser, isManagement, requireRole } from "@/lib/session"
import { action, ActionError } from "@/lib/action"
import { fields, parseForm } from "@/lib/validation"
import { serializable, type Tx } from "@/lib/db"
import { addStock, applyIncomingCost, recordSupplierPurchase, totalStock } from "@/lib/inventory"
import { parseRollWeights, roundMoney, roundQty } from "@/lib/domain/costing"
import { checkLowStock } from "@/lib/alerts"
import { formatNumber } from "@/lib/format"
import { getLocale, getT } from "@/i18n/server"
import { assertOrgSupplier } from "@/lib/guards"

const MAX_ROLLS_PER_BATCH = 200

/**
 * Rulon qabuli — ishchi ham bajara oladi (sexda kundalik ish), lekin narx va
 * ta'minotchini faqat rahbariyat kiritadi. Narx kiritilsa tannarx o'rtacha
 * tortilgan usulda yangilanadi.
 */
export const createRolls = action(async function createRolls(formData: FormData) {
  const me = await getSessionUser()
  const manager = isManagement(me.role)
  const t = await getT()
  const locale = await getLocale()
  const f = fields(t)
  const L = t.rolls
  const input = parseForm(z.object({
    productId: f.id(L.material),
    warehouseId: f.id(t.common.warehouse),
    weights: f.text(L.weights, 5000),
  }), formData)
  // Ishchi yuborgan narx/ta'minotchi e'tiborga olinmaydi
  const pricing = manager
    ? parseForm(z.object({
        unitPrice: f.nonNegative(t.inventory.unitPrice),
        supplierId: f.optionalId(),
        paidAmount: f.optionalNonNegative(t.inventory.paidNow),
      }), formData)
    : { unitPrice: undefined, supplierId: undefined, paidAmount: undefined }

  const [product, warehouse] = await Promise.all([
    prisma.product.findFirst({ where: { id: input.productId, organizationId: me.organizationId } }),
    prisma.warehouse.findFirst({ where: { id: input.warehouseId, organizationId: me.organizationId }, select: { id: true } })
  ])
  if (!product) throw new ActionError(t.errors.productNotFound)
  if (!product.isRawMaterial || !product.isRollTracked) throw new ActionError(L.notRollMaterial)
  if (!warehouse) throw new ActionError(t.errors.warehouseNotFound)

  const weights = parseRollWeights(input.weights)
  if (!weights) throw new ActionError(L.invalidWeights)
  if (weights.length > MAX_ROLLS_PER_BATCH) throw new ActionError(L.tooManyRolls)
  const totalWeight = roundQty(weights.reduce((acc, w) => acc + w, 0))

  const unitPrice = pricing.unitPrice
  const total = unitPrice !== undefined ? roundMoney(totalWeight * unitPrice) : 0
  if (pricing.supplierId) {
    await assertOrgSupplier(me.organizationId, pricing.supplierId)
    if (pricing.paidAmount === undefined) throw new ActionError(t.validation.required(t.inventory.paidNow))
    if (pricing.paidAmount > total) throw new ActionError(t.sales.paidMoreThanTotal)
  }

  await serializable(async (tx) => {
    const qtyBefore = await totalStock(tx, product.id)

    await tx.roll.createMany({
      data: weights.map(w => ({
        productId: product.id,
        warehouseId: warehouse.id,
        initialWeight: w,
        currentWeight: w,
        organizationId: me.organizationId
      }))
    })
    await addStock(tx, product.id, warehouse.id, totalWeight)
    if (unitPrice !== undefined) {
      await applyIncomingCost(tx, product, qtyBefore, totalWeight, unitPrice)
    }

    await tx.stockMovement.create({
      data: {
        type: 'IN',
        quantity: totalWeight,
        productId: product.id,
        toWarehouseId: warehouse.id,
        unitCost: unitPrice ?? product.costPrice,
        supplierId: pricing.supplierId ?? null,
        creatorId: me.id,
        organizationId: me.organizationId,
        note: L.receivedNote(weights.length, formatNumber(totalWeight, locale), product.unit),
      }
    })

    if (pricing.supplierId) {
      await recordSupplierPurchase(tx, {
        organizationId: me.organizationId,
        supplierId: pricing.supplierId,
        total,
        paid: pricing.paidAmount ?? 0,
        userId: me.id,
        note: product.name,
      })
    }
  })

  revalidatePath("/rolls")
  revalidatePath("/inventory")
  revalidatePath("/suppliers")
})

export type RollRow = {
  id: string
  productId: string
  productName: string
  unit: string
  warehouseId: string
  warehouseName: string
  initialWeight: number
  currentWeight: number
  status: 'AVAILABLE' | 'IN_USE' | 'FINISHED'
  createdAt: Date
}

export async function getRolls(productId?: string): Promise<RollRow[]> {
  const orgId = await getOrgId()
  const rolls = await prisma.roll.findMany({
    where: {
      organizationId: orgId,
      ...(productId ? { productId } : {}),
      status: { not: 'FINISHED' }
    },
    include: { product: { select: { name: true, unit: true } }, warehouse: { select: { name: true } } },
    orderBy: { createdAt: 'desc' }
  })
  return rolls.map(r => ({
    id: r.id,
    productId: r.productId,
    productName: r.product.name,
    unit: r.product.unit,
    warehouseId: r.warehouseId,
    warehouseName: r.warehouse.name,
    initialWeight: r.initialWeight,
    currentWeight: r.currentWeight,
    status: r.status,
    createdAt: r.createdAt,
  }))
}

/**
 * Ishlab chiqarish formasi uchun: tanlangan mahsulot resepti (BOM) dagi
 * rulonli xomashyolar va ularning ishlatishga tayyor rulonlari.
 */
export async function getRollOptionsForProduct(productId: string, warehouseId: string) {
  const orgId = await getOrgId()

  const bom = await prisma.bom.findMany({
    where: { productId, product: { organizationId: orgId } },
    include: { material: true }
  })

  const rollTracked = bom.filter(item => item.material.isRollTracked)
  if (rollTracked.length === 0) return []

  const rolls = await prisma.roll.findMany({
    where: {
      organizationId: orgId,
      warehouseId,
      productId: { in: rollTracked.map(i => i.materialId) },
      status: { not: 'FINISHED' },
      currentWeight: { gt: 0 }
    },
    orderBy: { createdAt: 'asc' }
  })

  return rollTracked.map(item => ({
    materialId: item.materialId,
    materialName: item.material.name,
    unit: item.material.unit,
    quantityNeeded: item.quantityNeeded,
    rolls: rolls
      .filter(r => r.productId === item.materialId)
      .map(r => ({
        id: r.id,
        currentWeight: r.currentWeight,
        initialWeight: r.initialWeight,
        status: r.status
      }))
  }))
}

/** Rulon vaznini ombordan ayiradi — eski nomuvofiq ma'lumotda qoldiq manfiyga tushmasin */
async function takeRollWeightFromStock(tx: Tx, productId: string, warehouseId: string, weight: number) {
  const level = await tx.stockLevel.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } }
  })
  if (!level) return 0
  const taken = Math.min(level.quantity, weight)
  await tx.stockLevel.update({ where: { id: level.id }, data: { quantity: roundQty(level.quantity - taken) } })
  return taken
}

/**
 * Rulonni qo'lda yopish (masalan, qoldig'i brak bo'lib chiqsa). Rulon tranzaksiya
 * ichida o'qiladi — parallel tikuv bilan qoldiq ikki marta ayirilmaydi.
 */
export const finishRoll = action(async function finishRoll(id: string) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const locale = await getLocale()

  const result = await serializable(async (tx) => {
    const roll = await tx.roll.findFirst({
      where: { id, organizationId: me.organizationId },
      include: { product: { select: { unit: true, costPrice: true } } }
    })
    if (!roll) throw new ActionError(t.errors.rollNotFound)
    if (roll.status === 'FINISHED') throw new ActionError(t.rolls.alreadyFinished)

    let taken = 0
    if (roll.currentWeight > 0) {
      taken = await takeRollWeightFromStock(tx, roll.productId, roll.warehouseId, roll.currentWeight)
      await tx.stockMovement.create({
        data: {
          type: 'WASTAGE',
          quantity: -roll.currentWeight,
          productId: roll.productId,
          fromWarehouseId: roll.warehouseId,
          rollId: roll.id,
          unitCost: roll.product.costPrice,
          creatorId: me.id,
          organizationId: me.organizationId,
          note: t.rolls.finishNote(`${formatNumber(roll.currentWeight, locale)} ${roll.product.unit}`)
        }
      })
    }

    await tx.roll.update({
      where: { id: roll.id },
      data: { currentWeight: 0, status: 'FINISHED' }
    })
    return { productId: roll.productId, taken }
  })

  await checkLowStock(result.productId, me.organizationId, result.taken)

  revalidatePath("/rolls")
  revalidatePath("/inventory")
  revalidatePath("/production")
})

/** Belgilangan rulonlarni boshqa omborga ko'chirish (qoldiqlar ham birga ko'chadi) */
export const transferRolls = action(async function transferRolls(formData: FormData) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const f = fields(t)
  const { toWarehouseId } = parseForm(z.object({ toWarehouseId: f.id(t.rolls.moveTo) }), formData)
  const rollIds = formData.getAll("rollId").filter((v): v is string => typeof v === "string" && v.length > 0)
  if (rollIds.length === 0) throw new ActionError(t.rolls.selectRolls)

  const warehouse = await prisma.warehouse.findFirst({ where: { id: toWarehouseId, organizationId: me.organizationId }, select: { id: true } })
  if (!warehouse) throw new ActionError(t.errors.warehouseNotFound)

  await serializable(async (tx) => {
    const rolls = await tx.roll.findMany({
      where: { id: { in: rollIds }, organizationId: me.organizationId, status: { not: 'FINISHED' } },
      include: { product: { select: { costPrice: true } } }
    })
    const toMove = rolls.filter(r => r.warehouseId !== warehouse.id)
    if (toMove.length === 0) throw new ActionError(t.rolls.rollsDifferentWarehouse)

    for (const roll of toMove) {
      const taken = await takeRollWeightFromStock(tx, roll.productId, roll.warehouseId, roll.currentWeight)
      await addStock(tx, roll.productId, warehouse.id, taken)
      await tx.roll.update({ where: { id: roll.id }, data: { warehouseId: warehouse.id } })
      await tx.stockMovement.create({
        data: {
          type: 'TRANSFER',
          quantity: roll.currentWeight,
          productId: roll.productId,
          fromWarehouseId: roll.warehouseId,
          toWarehouseId: warehouse.id,
          rollId: roll.id,
          unitCost: roll.product.costPrice,
          creatorId: me.id,
          organizationId: me.organizationId,
        }
      })
    }
  })

  revalidatePath("/rolls")
  revalidatePath("/inventory")
  revalidatePath("/history")
})
