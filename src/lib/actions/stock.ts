'use server'

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireRole } from "@/lib/session"
import { action, ActionError } from "@/lib/action"
import { fields, parseForm } from "@/lib/validation"
import { serializable } from "@/lib/db"
import { addStock, applyIncomingCost, recordSupplierPurchase, takeStock, totalStock } from "@/lib/inventory"
import { roundMoney, roundQty } from "@/lib/domain/costing"
import { checkLowStock } from "@/lib/alerts"
import { formatNumber } from "@/lib/format"
import { getLocale, getT } from "@/i18n/server"
import { assertOrgSupplier, assertOrgWarehouse, findOrgProduct } from "@/lib/guards"

/**
 * Kirim (xarid): narx majburiy — tannarx o'rtacha tortilgan usulda yangilanadi.
 * Ta'minotchi tanlansa, to'lanmagan qism unga qarz bo'lib yoziladi.
 */
export const stockIn = action(async function stockIn(formData: FormData) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const f = fields(t)
  const L = t.inventory
  const input = parseForm(z.object({
    productId: f.id(t.common.product),
    warehouseId: f.id(t.common.warehouse),
    quantity: f.positive(t.common.quantity),
    unitPrice: f.nonNegative(L.unitPrice),
    supplierId: f.optionalId(),
    paidAmount: f.optionalNonNegative(L.paidNow),
    note: f.optionalText(t.common.note),
  }), formData)

  const product = await findOrgProduct(me.organizationId, input.productId)
  if (product.isRollTracked) throw new ActionError(L.rollUseRollsPage)
  await assertOrgWarehouse(me.organizationId, input.warehouseId)

  const total = roundMoney(input.quantity * input.unitPrice)
  if (input.supplierId) {
    await assertOrgSupplier(me.organizationId, input.supplierId)
    if (input.paidAmount === undefined) throw new ActionError(t.validation.required(L.paidNow))
    if (input.paidAmount > total) throw new ActionError(t.sales.paidMoreThanTotal)
  }

  await serializable(async (tx) => {
    const qtyBefore = await totalStock(tx, product.id)
    await addStock(tx, product.id, input.warehouseId, input.quantity)
    await applyIncomingCost(tx, product, qtyBefore, input.quantity, input.unitPrice)

    await tx.stockMovement.create({
      data: {
        type: 'IN',
        quantity: roundQty(input.quantity),
        productId: product.id,
        toWarehouseId: input.warehouseId,
        unitCost: input.unitPrice,
        supplierId: input.supplierId ?? null,
        creatorId: me.id,
        organizationId: me.organizationId,
        note: input.note ?? null,
      }
    })

    if (input.supplierId) {
      await recordSupplierPurchase(tx, {
        organizationId: me.organizationId,
        supplierId: input.supplierId,
        total,
        paid: input.paidAmount ?? 0,
        userId: me.id,
        note: product.name,
      })
    }
  })

  revalidatePath("/inventory")
  revalidatePath("/history")
  revalidatePath("/suppliers")
})

/**
 * Brak (WASTAGE: yo'qotilgan miqdor) yoki taftish (REVISION: haqiqiy sanalgan qoldiq).
 * Boshqa turlar qabul qilinmaydi — aks holda soxta "ishlab chiqarish" yozish mumkin edi.
 */
export const stockAdjust = action(async function stockAdjust(formData: FormData) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const locale = await getLocale()
  const f = fields(t)
  const L = t.inventory
  const base = parseForm(z.object({
    productId: f.id(t.common.product),
    warehouseId: f.id(t.common.warehouse),
    type: f.oneOf(t.common.type, ['WASTAGE', 'REVISION'] as const),
    note: f.text(L.reasonRequired, 500),
  }), formData)
  const { quantity } = parseForm(z.object({
    quantity: base.type === 'WASTAGE' ? f.positive(L.wastageQty) : f.nonNegative(L.actualQty),
  }), formData)

  const product = await findOrgProduct(me.organizationId, base.productId)
  // Rulonli xomashyoning umumiy qoldig'i rulonlar yig'indisiga teng bo'lishi shart
  if (product.isRollTracked) throw new ActionError(L.rollAdjustUseRolls)
  await assertOrgWarehouse(me.organizationId, base.warehouseId)

  const decreasedBy = await serializable(async (tx) => {
    let diff: number
    if (base.type === 'WASTAGE') {
      const taken = await takeStock(tx, product.id, base.warehouseId, quantity)
      if (!taken.ok) throw new ActionError(L.notEnough(product.name, formatNumber(taken.available, locale)))
      diff = -quantity
    } else {
      const level = await tx.stockLevel.findUnique({
        where: { productId_warehouseId: { productId: product.id, warehouseId: base.warehouseId } }
      })
      diff = roundQty(quantity - (level?.quantity ?? 0))
      await tx.stockLevel.upsert({
        where: { productId_warehouseId: { productId: product.id, warehouseId: base.warehouseId } },
        update: { quantity: roundQty(quantity) },
        create: { productId: product.id, warehouseId: base.warehouseId, quantity: roundQty(quantity) }
      })
    }

    await tx.stockMovement.create({
      data: {
        type: base.type,
        quantity: diff,
        productId: product.id,
        fromWarehouseId: diff < 0 ? base.warehouseId : null,
        toWarehouseId: diff >= 0 ? base.warehouseId : null,
        unitCost: product.costPrice,
        creatorId: me.id,
        organizationId: me.organizationId,
        note: base.note,
      }
    })
    return -diff
  })

  await checkLowStock(product.id, me.organizationId, decreasedBy)

  revalidatePath("/inventory")
  revalidatePath("/history")
})

/** Oddiy (rulonsiz) mahsulotni bir ombordan boshqasiga ko'chirish */
export const transferStock = action(async function transferStock(formData: FormData) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const locale = await getLocale()
  const f = fields(t)
  const L = t.inventory
  const input = parseForm(z.object({
    productId: f.id(t.common.product),
    fromWarehouseId: f.id(L.fromWarehouse),
    toWarehouseId: f.id(L.toWarehouse),
    quantity: f.positive(t.common.quantity),
    note: f.optionalText(t.common.note),
  }), formData)

  if (input.fromWarehouseId === input.toWarehouseId) throw new ActionError(L.sameWarehouse)
  const product = await findOrgProduct(me.organizationId, input.productId)
  if (product.isRollTracked) throw new ActionError(L.rollTransferUseRollsPage)
  await assertOrgWarehouse(me.organizationId, input.fromWarehouseId)
  await assertOrgWarehouse(me.organizationId, input.toWarehouseId)

  await serializable(async (tx) => {
    const taken = await takeStock(tx, product.id, input.fromWarehouseId, input.quantity)
    if (!taken.ok) throw new ActionError(L.notEnough(product.name, formatNumber(taken.available, locale)))
    await addStock(tx, product.id, input.toWarehouseId, input.quantity)

    await tx.stockMovement.create({
      data: {
        type: 'TRANSFER',
        quantity: roundQty(input.quantity),
        productId: product.id,
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        unitCost: product.costPrice,
        creatorId: me.id,
        organizationId: me.organizationId,
        note: input.note ?? null,
      }
    })
  })

  revalidatePath("/inventory")
  revalidatePath("/history")
})
