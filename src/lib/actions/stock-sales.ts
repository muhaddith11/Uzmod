'use server'

import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { StockSaleKind } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/session"
import { action, ActionError } from "@/lib/action"
import { fields, parseForm } from "@/lib/validation"
import { serializable, type Tx } from "@/lib/db"
import { addStock, takeStock } from "@/lib/inventory"
import { QTY_EPSILON, roundMoney, roundQty } from "@/lib/domain/costing"
import { batchLabel, socksFromKg } from "@/lib/domain/machines"
import { defaultWarehouseId, settleDueLoads } from "@/lib/workshop"
import { formatNumber } from "@/lib/format"
import { parseDateRange, type DateRangeParams } from "@/lib/tz"
import { getLocale, getT } from "@/i18n/server"

function revalidateSales() {
  revalidatePath("/sales")
  revalidatePath("/stock")
  revalidatePath("/finance")
  revalidatePath("/")
}

const KINDS = ["YARN", "FINISHED", "DEFECT"] as const satisfies readonly StockSaleKind[]

/** Sotuv formasi: faqat omborda bor narsalar — ip, tayyor partiya, brak */
export async function getSaleOptions() {
  const { organizationId } = await requireRole('ADMIN', 'MANAGER')
  await settleDueLoads(organizationId)
  const [yarns, batches, customers] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId, isRawMaterial: true, yarnType: { not: null } },
      include: { stockLevels: { select: { quantity: true } } },
      orderBy: [{ yarnType: 'asc' }, { color: 'asc' }],
    }),
    prisma.batch.findMany({
      where: { organizationId, OR: [{ finishedKg: { gt: QTY_EPSILON } }, { defectKg: { gt: QTY_EPSILON } }] },
      include: { yarn: { select: { name: true } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.customer.findMany({
      where: { organizationId },
      select: { id: true, name: true, phone: true, debt: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const items: { value: string; kind: StockSaleKind; label: string; availableKg: number; gramsPerSock: number | null }[] = []
  for (const b of batches) {
    const label = batchLabel(b.date, b.yarn.name, b.gramsPerSock)
    if (b.finishedKg > QTY_EPSILON) items.push({ value: `FINISHED:${b.id}`, kind: 'FINISHED', label, availableKg: roundQty(b.finishedKg), gramsPerSock: b.gramsPerSock })
    if (b.defectKg > QTY_EPSILON) items.push({ value: `DEFECT:${b.id}`, kind: 'DEFECT', label, availableKg: roundQty(b.defectKg), gramsPerSock: b.gramsPerSock })
  }
  for (const y of yarns) {
    const kg = roundQty(y.stockLevels.reduce((acc, sl) => acc + sl.quantity, 0))
    if (kg > QTY_EPSILON) items.push({ value: `YARN:${y.id}`, kind: 'YARN', label: y.name, availableKg: kg, gramsPerSock: null })
  }

  return {
    items,
    customers: customers.map(c => ({ id: c.id, name: c.name, phone: c.phone, debt: Number(c.debt) })),
  }
}

function saleLabel(sale: { kind: StockSaleKind; yarn: { name: string } | null; batch: { date: string; gramsPerSock: number; yarn: { name: string } } | null }) {
  if (sale.batch) return batchLabel(sale.batch.date, sale.batch.yarn.name, sale.batch.gramsPerSock)
  return sale.yarn?.name ?? "—"
}

export async function getStockSales(range: DateRangeParams = {}) {
  const { organizationId } = await requireRole('ADMIN', 'MANAGER')
  const createdAt = parseDateRange(range)
  const sales = await prisma.stockSale.findMany({
    where: { organizationId, ...(createdAt ? { createdAt } : {}) },
    include: {
      yarn: { select: { name: true } },
      batch: { select: { date: true, gramsPerSock: true, yarn: { select: { name: true } } } },
      customer: { select: { name: true, phone: true } },
      createdBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  })
  const rows = sales.map(s => {
    const total = Number(s.totalAmount)
    const paid = Number(s.paidAmount)
    return {
      id: s.id,
      kind: s.kind,
      label: saleLabel(s),
      kg: s.kg,
      socks: s.batch ? socksFromKg(s.kg, s.batch.gramsPerSock) : null,
      total,
      paid,
      debt: roundMoney(total - paid),
      customerName: s.customer?.name ?? null,
      note: s.note,
      createdByName: s.createdBy?.name ?? s.createdBy?.email ?? null,
      createdAt: s.createdAt,
    }
  })
  return {
    rows,
    totals: rows.reduce(
      (acc, r) => ({ kg: roundQty(acc.kg + r.kg), total: roundMoney(acc.total + r.total), paid: roundMoney(acc.paid + r.paid), debt: roundMoney(acc.debt + r.debt) }),
      { kg: 0, total: 0, paid: 0, debt: 0 },
    ),
  }
}

/** Xaridor: ism bo'yicha mavjudi (katta-kichik harfsiz) yoki yangisi */
async function resolveCustomer(tx: Tx, organizationId: string, name: string | undefined, phone: string | undefined) {
  if (!name) return null
  const existing = await tx.customer.findFirst({
    where: { organizationId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true, phone: true },
  })
  if (existing) {
    if (phone && !existing.phone) await tx.customer.update({ where: { id: existing.id }, data: { phone } })
    return existing.id
  }
  const created = await tx.customer.create({ data: { name, phone: phone ?? null, organizationId }, select: { id: true } })
  return created.id
}

/**
 * Ombordan sotuv: tanlangan narsadan kg ayiriladi, summa va to'langani yoziladi.
 * To'lanmagan qism xaridor qarziga (nasiya) o'tadi.
 */
export const createStockSale = action(async function createStockSale(formData: FormData) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const locale = await getLocale()
  const f = fields(t)
  const S = t.stockSales
  const input = parseForm(z.object({
    item: f.text(S.item, 100),
    kg: f.positive(S.kg),
    total: f.positive(S.total),
    paid: f.optionalNonNegative(S.paid),
    customerName: f.optionalText(S.customer, 150),
    customerPhone: f.optionalText(t.common.phone, 40),
    note: f.optionalText(t.common.note),
  }), formData)

  const [kindRaw, refId] = input.item.split(":")
  const kind = KINDS.find(k => k === kindRaw)
  if (!kind || !refId) throw new ActionError(S.itemNotFound)
  const kg = roundQty(input.kg)
  const total = roundMoney(input.total)
  const paid = roundMoney(input.paid ?? input.total)
  if (paid > total) throw new ActionError(S.paidTooMuch)
  if (paid < total && !input.customerName) throw new ActionError(S.customerRequired)

  await serializable(async (tx) => {
    const notEnough = (available: number) => new ActionError(S.notEnough(`${formatNumber(available, locale)} kg`))

    let yarnId: string | null = null
    let batchId: string | null = null
    if (kind === 'YARN') {
      const yarn = await tx.product.findFirst({ where: { id: refId, organizationId: me.organizationId, isRawMaterial: true } })
      if (!yarn) throw new ActionError(S.itemNotFound)
      const warehouseId = await defaultWarehouseId(tx, me.organizationId)
      const taken = await takeStock(tx, yarn.id, warehouseId, kg)
      if (!taken.ok) throw notEnough(taken.available)
      await tx.stockMovement.create({
        data: {
          type: 'OUT', quantity: -kg, productId: yarn.id, fromWarehouseId: warehouseId,
          creatorId: me.id, organizationId: me.organizationId, note: S.yarnSaleNote,
        },
      })
      yarnId = yarn.id
    } else {
      const batch = await tx.batch.findFirst({ where: { id: refId, organizationId: me.organizationId } })
      if (!batch) throw new ActionError(S.itemNotFound)
      const field = kind === 'FINISHED' ? 'finishedKg' : 'defectKg'
      const available = batch[field]
      if (kg > available + QTY_EPSILON) throw notEnough(available)
      const left = roundQty(available - kg)
      await tx.batch.update({ where: { id: batch.id }, data: { [field]: Math.abs(left) < QTY_EPSILON ? 0 : left } })
      batchId = batch.id
    }

    const customerId = await resolveCustomer(tx, me.organizationId, input.customerName, input.customerPhone)
    if (customerId && paid < total) {
      await tx.customer.update({ where: { id: customerId }, data: { debt: { increment: roundMoney(total - paid) } } })
    }
    const sale = await tx.stockSale.create({
      data: {
        kind, yarnId, batchId, kg, totalAmount: total, paidAmount: paid, customerId,
        note: input.note ?? null, createdById: me.id, organizationId: me.organizationId,
      },
    })
    if (batchId) {
      await tx.batchMovement.create({
        data: { batchId, type: 'SALE', kg, saleId: sale.id, createdById: me.id, organizationId: me.organizationId },
      })
    }
  })
  revalidateSales()
})

/** Xato kiritilgan sotuvni bekor qilish (faqat admin): kg omborga qaytadi, nasiya kamayadi */
export const cancelStockSale = action(async function cancelStockSale(saleId: string) {
  const me = await requireRole('ADMIN')
  const t = await getT()

  await serializable(async (tx) => {
    const sale = await tx.stockSale.findFirst({ where: { id: saleId, organizationId: me.organizationId } })
    if (!sale) throw new ActionError(t.errors.recordNotFound)

    if (sale.yarnId) {
      const warehouseId = await defaultWarehouseId(tx, me.organizationId)
      await addStock(tx, sale.yarnId, warehouseId, sale.kg)
      await tx.stockMovement.create({
        data: {
          type: 'RETURN', quantity: sale.kg, productId: sale.yarnId, toWarehouseId: warehouseId,
          creatorId: me.id, organizationId: me.organizationId, note: t.stockSales.cancelNote,
        },
      })
    } else if (sale.batchId) {
      const field = sale.kind === 'DEFECT' ? 'defectKg' : 'finishedKg'
      await tx.batch.update({ where: { id: sale.batchId }, data: { [field]: { increment: sale.kg } } })
      await tx.batchMovement.create({
        data: { batchId: sale.batchId, type: 'SALE_CANCEL', kg: sale.kg, saleId: sale.id, createdById: me.id, organizationId: me.organizationId },
      })
    }

    const unpaid = roundMoney(Number(sale.totalAmount) - Number(sale.paidAmount))
    if (sale.customerId && unpaid > 0) {
      await tx.customer.update({ where: { id: sale.customerId }, data: { debt: { decrement: unpaid } } })
    }
    await tx.stockSale.delete({ where: { id: sale.id } })
  })
  revalidateSales()
})
