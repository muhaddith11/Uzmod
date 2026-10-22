'use server'

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/session"
import { action, ActionError } from "@/lib/action"
import { fields, parseForm, parseInput } from "@/lib/validation"
import { serializable } from "@/lib/db"
import { addStock, applyIncomingCost, takeStock, totalStock } from "@/lib/inventory"
import { roundMoney, roundQty } from "@/lib/domain/costing"
import { checkLowStock } from "@/lib/alerts"
import { assertOrgCustomer, assertOrgWarehouse } from "@/lib/guards"
import { formatMoney, formatNumber } from "@/lib/format"
import { parseDateRange, type DateRangeParams } from "@/lib/tz"
import { getLocale, getT } from "@/i18n/server"

const MAX_LINES = 50

/**
 * Bir nechta mahsulotli sotuv. Qatorlar `items` maydonida JSON: [{productId, quantity, price}].
 * Jami summa serverda hisoblanadi (client'ga ishonilmaydi). To'lanmagan qism mijoz qarziga yoziladi.
 */
export const createSale = action(async function createSale(formData: FormData) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const locale = await getLocale()
  const f = fields(t)
  const S = t.sales

  const head = parseForm(z.object({
    warehouseId: f.id(S.warehouse),
    customerId: f.optionalId(),
    paymentType: f.oneOf(S.paymentType, ['CASH', 'CARD', 'DEBT'] as const),
    paidAmount: f.nonNegative(S.paidAmount),
    items: z.string(),
  }), formData)

  let rawItems: unknown
  try {
    rawItems = JSON.parse(head.items)
  } catch {
    throw new ActionError(t.errors.invalidJson)
  }
  const items = parseInput(
    z.array(z.object({
      productId: f.id(t.common.product),
      quantity: f.positive(t.common.quantity),
      price: f.nonNegative(S.unitPrice),
    })).min(1, S.noItems).max(MAX_LINES, S.tooManyItems),
    rawItems,
  ).map(i => ({ ...i, quantity: roundQty(i.quantity), price: roundMoney(i.price) }))

  const total = roundMoney(items.reduce((acc, i) => acc + i.quantity * i.price, 0))
  const paid = roundMoney(head.paidAmount)
  if (paid > total) throw new ActionError(S.paidMoreThanTotal)
  if (head.paymentType === 'DEBT' && !head.customerId) throw new ActionError(S.needCustomerForDebt)
  // To'lanmagan qoldiq mijoz qarziga yoziladi. Mijozsiz bu pul hech qayerda qolmasdi
  if (paid < total && !head.customerId) throw new ActionError(S.needCustomerForPartial)

  await assertOrgWarehouse(me.organizationId, head.warehouseId)
  if (head.customerId) await assertOrgCustomer(me.organizationId, head.customerId)

  const productIds = [...new Set(items.map(i => i.productId))]
  const neededByProduct = new Map<string, number>()
  for (const i of items) neededByProduct.set(i.productId, roundQty((neededByProduct.get(i.productId) ?? 0) + i.quantity))

  await serializable(async (tx) => {
    const products = await tx.product.findMany({ where: { id: { in: productIds }, organizationId: me.organizationId } })
    if (products.length !== productIds.length) throw new ActionError(t.errors.productNotFound)
    const byId = new Map(products.map(p => [p.id, p]))

    for (const [productId, qty] of neededByProduct) {
      const product = byId.get(productId)!
      if (product.isRollTracked) throw new ActionError(S.rollNotForSale(product.name))
      const taken = await takeStock(tx, productId, head.warehouseId, qty)
      if (!taken.ok) {
        throw new ActionError(t.inventory.notEnough(product.name, `${formatNumber(taken.available, locale)} ${product.unit}`))
      }
    }

    const sale = await tx.sale.create({
      data: {
        totalAmount: total,
        paidAmount: paid,
        paymentType: head.paymentType,
        customerId: head.customerId ?? null,
        warehouseId: head.warehouseId,
        createdById: me.id,
        organizationId: me.organizationId,
        items: {
          create: items.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
            price: i.price,
            // Tannarx sotuv paytidagi o'rtacha qiymatdan snapshot qilinadi
            costPrice: byId.get(i.productId)!.costPrice,
          }))
        }
      }
    })

    const note = S.saleNote(S.payment[head.paymentType], formatMoney(total, locale), formatMoney(paid, locale))
    for (const i of items) {
      await tx.stockMovement.create({
        data: {
          type: 'OUT',
          quantity: -i.quantity,
          productId: i.productId,
          fromWarehouseId: head.warehouseId,
          saleId: sale.id,
          unitCost: byId.get(i.productId)!.costPrice,
          creatorId: me.id,
          organizationId: me.organizationId,
          note,
        }
      })
    }

    const debtAmount = roundMoney(total - paid)
    if (debtAmount > 0 && head.customerId) {
      await tx.customer.update({
        where: { id: head.customerId },
        data: { debt: { increment: debtAmount } }
      })
    }
  })

  for (const [productId, qty] of neededByProduct) {
    await checkLowStock(productId, me.organizationId, qty)
  }

  revalidatePath("/inventory")
  revalidatePath("/customers")
  revalidatePath("/sales/products")
})

/**
 * Sotuvni bekor qilish (qaytarish): mahsulot sotilgan omborga sotuv tannarxida
 * qaytadi, mijozning shu sotuvdagi qarzi kamayadi. Faqat admin — aks holda pulni
 * olib, sotuvni bekor qilib yuborish mumkin bo'lardi.
 */
export const cancelSale = action(async function cancelSale(formData: FormData) {
  const me = await requireRole('ADMIN')
  const t = await getT()
  const f = fields(t)
  const S = t.sales
  const input = parseForm(z.object({
    saleId: f.id(t.errors.saleNotFound),
    reason: f.text(S.cancelReason, 300),
  }), formData)

  await serializable(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: input.saleId, organizationId: me.organizationId },
      include: { items: { include: { product: true } } }
    })
    if (!sale) throw new ActionError(t.errors.saleNotFound)
    if (sale.status === 'CANCELLED') throw new ActionError(S.alreadyCancelled)
    if (!sale.warehouseId) throw new ActionError(S.legacyNoWarehouse)

    for (const item of sale.items) {
      const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } })
      const qtyBefore = await totalStock(tx, item.productId)
      await addStock(tx, item.productId, sale.warehouseId, item.quantity)
      await applyIncomingCost(tx, product, qtyBefore, item.quantity, Number(item.costPrice))
      await tx.stockMovement.create({
        data: {
          type: 'RETURN',
          quantity: item.quantity,
          productId: item.productId,
          toWarehouseId: sale.warehouseId,
          saleId: sale.id,
          unitCost: item.costPrice,
          creatorId: me.id,
          organizationId: me.organizationId,
          note: S.returnNote(input.reason),
        }
      })
    }

    // Mijoz keyin qarzni to'lagan bo'lsa, qarz manfiyga o'tadi — bu mijozning avansi
    const debtPart = roundMoney(Number(sale.totalAmount) - Number(sale.paidAmount))
    if (sale.customerId && debtPart > 0) {
      await tx.customer.update({ where: { id: sale.customerId }, data: { debt: { decrement: debtPart } } })
    }

    await tx.sale.update({
      where: { id: sale.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: me.id, cancelReason: input.reason }
    })
  })

  revalidatePath("/inventory")
  revalidatePath("/customers")
  revalidatePath("/sales/products")
  revalidatePath("/reports")
})

export type SaleRow = {
  id: string
  createdAt: Date
  customerName: string | null
  warehouseName: string | null
  totalAmount: number
  paidAmount: number
  paymentType: 'CASH' | 'CARD' | 'DEBT'
  status: 'ACTIVE' | 'CANCELLED'
  cancelReason: string | null
  createdByName: string | null
  items: { productName: string; unit: string; quantity: number; price: number }[]
}

export async function getSales(range: DateRangeParams = {}, limit = 200): Promise<SaleRow[]> {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const createdAt = parseDateRange(range)
  const sales = await prisma.sale.findMany({
    where: { organizationId: orgId, ...(createdAt ? { createdAt } : {}) },
    include: {
      customer: { select: { name: true } },
      warehouse: { select: { name: true } },
      createdBy: { select: { name: true, email: true } },
      items: { include: { product: { select: { name: true, unit: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  })
  return sales.map(s => ({
    id: s.id,
    createdAt: s.createdAt,
    customerName: s.customer?.name ?? null,
    warehouseName: s.warehouse?.name ?? null,
    totalAmount: Number(s.totalAmount),
    paidAmount: Number(s.paidAmount),
    paymentType: s.paymentType,
    status: s.status,
    cancelReason: s.cancelReason,
    createdByName: s.createdBy?.name ?? s.createdBy?.email ?? null,
    items: s.items.map(i => ({
      productName: i.product.name,
      unit: i.product.unit,
      quantity: i.quantity,
      price: Number(i.price),
    })),
  }))
}
