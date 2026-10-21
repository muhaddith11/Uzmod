import type { Tx } from "@/lib/db"
import { QTY_EPSILON, roundMoney, roundQty, weightedAverageCost } from "@/lib/domain/costing"

/** Mahsulotning barcha omborlardagi jami qoldig'i */
export async function totalStock(tx: Tx, productId: string): Promise<number> {
  const agg = await tx.stockLevel.aggregate({ where: { productId }, _sum: { quantity: true } })
  return agg._sum.quantity ?? 0
}

export async function addStock(tx: Tx, productId: string, warehouseId: string, quantity: number) {
  await tx.stockLevel.upsert({
    where: { productId_warehouseId: { productId, warehouseId } },
    update: { quantity: { increment: roundQty(quantity) } },
    create: { productId, warehouseId, quantity: roundQty(quantity) },
  })
}

/**
 * Ombordan miqdorni ayiradi. Yetmasa hech narsa o'zgarmaydi va `ok: false` qaytadi —
 * chaqiruvchi tushunarli xato beradi. SERIALIZABLE tranzaksiya ichida chaqirilishi kerak.
 */
export async function takeStock(
  tx: Tx,
  productId: string,
  warehouseId: string,
  quantity: number,
): Promise<{ ok: true } | { ok: false; available: number }> {
  const level = await tx.stockLevel.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  })
  const available = level?.quantity ?? 0
  if (!level || available < quantity - QTY_EPSILON) return { ok: false, available }

  // Float qoldig'i -0.00001 kabi bo'lib qolmasin
  const next = roundQty(available - quantity)
  await tx.stockLevel.update({
    where: { id: level.id },
    data: { quantity: Math.abs(next) < QTY_EPSILON ? 0 : next },
  })
  return { ok: true }
}

/**
 * Kirimdan keyin mahsulotning o'rtacha tortilgan tannarxini yangilaydi.
 * `qtyBefore` — kirimdan OLDINGI jami qoldiq.
 */
export async function applyIncomingCost(
  tx: Tx,
  product: { id: string; costPrice: unknown },
  qtyBefore: number,
  addedQty: number,
  addedUnitCost: number,
): Promise<number> {
  const newCost = weightedAverageCost(qtyBefore, Number(product.costPrice ?? 0), addedQty, addedUnitCost)
  await tx.product.update({ where: { id: product.id }, data: { costPrice: newCost } })
  return newCost
}

/**
 * Ta'minotchidan xarid: to'lanmagan qism qarzga yoziladi, to'langani to'lov sifatida
 * qayd etiladi (pul oqimi hisobotida ko'rinadi).
 */
export async function recordSupplierPurchase(
  tx: Tx,
  params: { organizationId: string; supplierId: string; total: number; paid: number; userId: string; note?: string | null },
) {
  const total = roundMoney(params.total)
  const paid = roundMoney(params.paid)
  await tx.supplier.update({
    where: { id: params.supplierId },
    data: { debt: { increment: roundMoney(total - paid) } },
  })
  if (paid > 0) {
    await tx.supplierPayment.create({
      data: {
        amount: paid,
        note: params.note ?? null,
        supplierId: params.supplierId,
        organizationId: params.organizationId,
        createdById: params.userId,
      },
    })
  }
}
