'use server'

import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/session"
import { parseDateRange, type DateRangeParams } from "@/lib/tz"
import { computeFinancials } from "@/lib/domain/financials"
import { getT } from "@/i18n/server"

export async function getFinancialSummary(range: DateRangeParams = {}) {
  // Moliyaviy ko'rsatkichlar — faqat rahbariyatga
  const { organizationId: orgId } = await requireRole('ADMIN')
  const t = await getT()

  // Oqim qiymatlari tanlangan davr bo'yicha (Toshkent kunlari); qarzlar va ombor
  // bahosi esa "hozirgi" holat — davrga bog'liq emas.
  const createdAt = parseDateRange(range)
  const dateWhere = createdAt ? { createdAt } : {}

  const [
    saleItems, salesPaid, debtPayments, expenses, adjustments, production,
    purchases, supplierPayments, stock, customerDebt, supplierDebt,
  ] = await Promise.all([
    prisma.saleItem.findMany({
      where: { sale: { organizationId: orgId, status: 'ACTIVE', ...dateWhere } },
      select: { price: true, costPrice: true, quantity: true }
    }),
    prisma.sale.aggregate({
      where: { organizationId: orgId, status: 'ACTIVE', ...dateWhere },
      _sum: { paidAmount: true }
    }),
    prisma.debtPayment.aggregate({ where: { organizationId: orgId, ...dateWhere }, _sum: { amount: true } }),
    prisma.expense.findMany({ where: { organizationId: orgId, ...dateWhere }, select: { category: true, amount: true } }),
    prisma.staffAdjustment.aggregate({ where: { organizationId: orgId, ...dateWhere }, _sum: { amount: true } }),
    prisma.stockMovement.findMany({
      where: { organizationId: orgId, type: 'PRODUCTION', quantity: { gt: 0 }, ...dateWhere },
      select: { quantity: true, unitWage: true, product: { select: { productionWage: true } } }
    }),
    prisma.stockMovement.findMany({
      where: { organizationId: orgId, type: 'IN', ...dateWhere },
      select: { quantity: true, unitCost: true }
    }),
    prisma.supplierPayment.aggregate({ where: { organizationId: orgId, ...dateWhere }, _sum: { amount: true } }),
    prisma.stockLevel.findMany({
      where: { product: { organizationId: orgId } },
      select: { quantity: true, product: { select: { costPrice: true } } }
    }),
    prisma.customer.aggregate({ where: { organizationId: orgId, debt: { gt: 0 } }, _sum: { debt: true } }),
    prisma.supplier.aggregate({ where: { organizationId: orgId }, _sum: { debt: true } }),
  ])

  return computeFinancials({
    saleItems: saleItems.map(i => ({ price: Number(i.price), costPrice: Number(i.costPrice), quantity: i.quantity })),
    salesPaid: Number(salesPaid._sum.paidAmount ?? 0),
    debtPayments: Number(debtPayments._sum.amount ?? 0),
    expenses: expenses.map(e => ({ category: e.category, amount: Number(e.amount) })),
    adjustmentsTotal: Number(adjustments._sum.amount ?? 0),
    // Eski yozuvlarda unitWage yo'q — o'shanda mahsulotning joriy ishbay haqi olinadi
    production: production.map(m => ({
      quantity: m.quantity,
      unitWage: Number(m.unitWage ?? m.product.productionWage ?? 0),
    })),
    purchases: purchases.map(m => ({ quantity: m.quantity, unitCost: Number(m.unitCost ?? 0) })),
    supplierPayments: Number(supplierPayments._sum.amount ?? 0),
    inventory: stock.map(s => ({ quantity: s.quantity, costPrice: Number(s.product.costPrice) })),
    customerDebt: Number(customerDebt._sum.debt ?? 0),
    supplierDebt: Number(supplierDebt._sum.debt ?? 0),
    bonusCategoryLabel: t.reports.bonusCategory,
  })
}
