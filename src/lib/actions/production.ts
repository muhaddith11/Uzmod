'use server'

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getOrgId, getSessionUser } from "@/lib/session"
import { action, ActionError } from "@/lib/action"
import { fields, parseForm } from "@/lib/validation"
import { serializable } from "@/lib/db"
import { addStock, applyIncomingCost, takeStock, totalStock } from "@/lib/inventory"
import { allocateFromRolls, productionUnitCost, QTY_EPSILON, roundQty } from "@/lib/domain/costing"
import { checkLowStock } from "@/lib/alerts"
import { assertOrgWarehouse } from "@/lib/guards"
import { formatMoney, formatNumber } from "@/lib/format"
import { getLocale, getT } from "@/i18n/server"

/**
 * Ishlab chiqarish — ishchi ham bajara oladi (sexdagi asosiy kundalik amal).
 * Xomashyo resept bo'yicha ayiriladi (rulonlidan FIFO), tayyor mahsulot qo'shiladi.
 * Bir dona tannarxi = xomashyo (o'rtacha tannarxda) + ishbay haq; mahsulotning
 * tannarxi o'rtacha tortilgan usulda yangilanadi. Ishbay haq harakatga yoziladi —
 * keyin narx o'zgarsa ham ish haqi tarixi buzilmaydi.
 */
export const produceProduct = action(async function produceProduct(formData: FormData) {
  const me = await getSessionUser()
  const t = await getT()
  const locale = await getLocale()
  const f = fields(t)
  const P = t.production
  const input = parseForm(z.object({
    productId: f.id(t.common.product),
    fromWarehouseId: f.id(P.fromWarehouse),
    toWarehouseId: f.id(P.toWarehouse),
    quantityProduced: f.positive(P.quantity),
    workerId: f.optionalId(),
  }), formData)

  // Ishchi faqat o'z nomidan yozadi; rahbariyat mas'ul ishchini tanlaydi
  const workerId = me.role === 'WORKER' ? me.id : (input.workerId ?? me.id)
  const quantity = roundQty(input.quantityProduced)

  const product = await prisma.product.findFirst({
    where: { id: input.productId, organizationId: me.organizationId, isRawMaterial: false }
  })
  if (!product) throw new ActionError(t.errors.finishedProductNotFound)
  await assertOrgWarehouse(me.organizationId, input.fromWarehouseId)
  await assertOrgWarehouse(me.organizationId, input.toWarehouseId)

  const worker = await prisma.user.findFirst({
    where: { id: workerId, organizationId: me.organizationId, isActive: true },
    select: { id: true }
  })
  if (!worker) throw new ActionError(t.errors.workerNotFound)

  const bom = await prisma.bom.findMany({ where: { productId: product.id }, include: { material: true } })
  if (bom.length === 0) throw new ActionError(P.noBom)

  // Rulonli xomashyo uchun ishchi boshlang'ich rulonni tanlaydi. Forma maydoni: rollId_<materialId>
  const selectedRollIds = new Map<string, string>()
  for (const item of bom) {
    if (!item.material.isRollTracked) continue
    const rollId = formData.get(`rollId_${item.materialId}`)
    if (typeof rollId !== 'string' || !rollId) throw new ActionError(P.chooseRoll(item.material.name))
    selectedRollIds.set(item.materialId, rollId)
  }

  const fmt = (n: number) => formatNumber(n, locale)

  const consumed = await serializable(async (tx) => {
    // Tannarx tranzaksiya ichidagi eng so'nggi qiymatlardan olinadi
    const materials = await tx.product.findMany({
      where: { id: { in: bom.map(i => i.materialId) }, organizationId: me.organizationId }
    })
    const materialById = new Map(materials.map(m => [m.id, m]))
    const usage: { materialId: string; needed: number }[] = []

    for (const item of bom) {
      const material = materialById.get(item.materialId)
      if (!material) throw new ActionError(t.errors.materialNotFound)
      const needed = roundQty(item.quantityNeeded * quantity)

      const taken = await takeStock(tx, material.id, input.fromWarehouseId, needed)
      if (!taken.ok) {
        throw new ActionError(P.notEnoughMaterial(material.name, `${fmt(needed)} ${material.unit}`, `${fmt(taken.available)} ${material.unit}`))
      }

      if (material.isRollTracked) {
        // Ishchi tanlagan rulondan boshlab FIFO; bitta rulon yetmasa keyingi eng eskilariga o'tamiz
        const startRoll = await tx.roll.findFirst({
          where: {
            id: selectedRollIds.get(material.id),
            organizationId: me.organizationId,
            productId: material.id,
            warehouseId: input.fromWarehouseId
          }
        })
        if (!startRoll) throw new ActionError(P.rollNotHere(material.name))
        if (startRoll.status === 'FINISHED' || startRoll.currentWeight <= 0) {
          throw new ActionError(P.rollFinished(material.name))
        }

        const otherRolls = await tx.roll.findMany({
          where: {
            organizationId: me.organizationId,
            productId: material.id,
            warehouseId: input.fromWarehouseId,
            status: { not: 'FINISHED' },
            currentWeight: { gt: 0 },
            id: { not: startRoll.id }
          },
          // Bir partiyadagi rulonlarning vaqti bir xil — tartib barqaror bo'lsin
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
        })

        const plan = allocateFromRolls([startRoll, ...otherRolls], needed)
        if (plan.shortfall > QTY_EPSILON) {
          const inRolls = [startRoll, ...otherRolls].reduce((acc, r) => acc + r.currentWeight, 0)
          throw new ActionError(P.notEnoughRolls(material.name, `${fmt(needed)} ${material.unit}`, `${fmt(inRolls)} ${material.unit}`))
        }

        // Har bir rulondan olingan miqdor alohida auditga yoziladi
        for (const take of plan.takes) {
          await tx.roll.update({
            where: { id: take.rollId },
            data: { currentWeight: take.leftover, status: take.finished ? 'FINISHED' : 'IN_USE' }
          })
          await tx.stockMovement.create({
            data: {
              type: 'PRODUCTION',
              quantity: -take.take,
              productId: material.id,
              fromWarehouseId: input.fromWarehouseId,
              rollId: take.rollId,
              unitCost: material.costPrice,
              creatorId: me.id,
              organizationId: me.organizationId,
              note: P.consumedNote(fmt(quantity))
            }
          })
        }
      } else {
        await tx.stockMovement.create({
          data: {
            type: 'PRODUCTION',
            quantity: -needed,
            productId: material.id,
            fromWarehouseId: input.fromWarehouseId,
            unitCost: material.costPrice,
            creatorId: me.id,
            organizationId: me.organizationId,
            note: P.consumedNote(fmt(quantity))
          }
        })
      }
      usage.push({ materialId: material.id, needed })
    }

    const unit = productionUnitCost(
      bom.map(item => ({
        quantityNeeded: item.quantityNeeded,
        materialCost: Number(materialById.get(item.materialId)!.costPrice),
      })),
      Number(product.productionWage ?? 0),
    )

    const finished = await tx.product.findUniqueOrThrow({ where: { id: product.id } })
    const qtyBefore = await totalStock(tx, product.id)
    await addStock(tx, product.id, input.toWarehouseId, quantity)
    await applyIncomingCost(tx, finished, qtyBefore, quantity, unit.total)

    await tx.stockMovement.create({
      data: {
        type: 'PRODUCTION',
        quantity,
        productId: product.id,
        toWarehouseId: input.toWarehouseId,
        workerId,
        unitCost: unit.total,
        unitWage: unit.wage,
        creatorId: me.id,
        organizationId: me.organizationId,
        note: P.producedNote(formatMoney(unit.total, locale), formatMoney(unit.wage, locale))
      }
    })

    return usage
  })

  // Ogohlantirishlar tranzaksiyadan tashqarida
  for (const item of consumed) {
    await checkLowStock(item.materialId, me.organizationId, item.needed)
  }

  revalidatePath("/inventory")
  revalidatePath("/production")
  revalidatePath("/rolls")
})

export async function getProductionLogs(limit = 100) {
  const orgId = await getOrgId()
  const logs = await prisma.stockMovement.findMany({
    where: { organizationId: orgId, type: 'PRODUCTION', quantity: { gt: 0 } },
    include: {
      product: { select: { name: true, unit: true } },
      toWarehouse: { select: { name: true } },
      worker: { select: { name: true, email: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  })
  return logs.map(m => ({
    id: m.id,
    productName: m.product.name,
    unit: m.product.unit,
    quantity: m.quantity,
    warehouseName: m.toWarehouse?.name ?? null,
    workerName: m.worker?.name ?? m.worker?.email ?? null,
    unitCost: m.unitCost === null ? null : Number(m.unitCost),
    createdAt: m.createdAt,
  }))
}
