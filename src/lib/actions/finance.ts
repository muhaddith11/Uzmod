'use server'

import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/session"
import { roundMoney, roundQty } from "@/lib/domain/costing"
import { EXPENSE_CATEGORIES, isExpenseCategory } from "@/lib/domain/expenses"
import { getExpenses } from "@/lib/actions/expenses"
import { parseDateRange } from "@/lib/tz"

/**
 * Moliya bitta joyda: davrdagi sotuv, kassaga tushgan pul (sotuvda to'langani +
 * qarz to'lovlari), xarajatlar va qoldiq; hozirgi qarzdorlar.
 */
export async function getFinanceSummary(range: { from: string; to: string }) {
  const { organizationId } = await requireRole('ADMIN')
  const createdAt = parseDateRange(range)
  const [sales, debtPayments, expenses, debtors, payments] = await Promise.all([
    prisma.stockSale.aggregate({
      where: { organizationId, createdAt },
      _sum: { totalAmount: true, paidAmount: true, kg: true },
      _count: { _all: true },
    }),
    prisma.debtPayment.aggregate({ where: { organizationId, createdAt }, _sum: { amount: true } }),
    getExpenses(range),
    prisma.customer.findMany({
      where: { organizationId, debt: { gt: 0.009 } },
      select: { id: true, name: true, phone: true, debt: true },
      orderBy: { debt: 'desc' },
    }),
    prisma.debtPayment.findMany({
      where: { organizationId, createdAt },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  const salesTotal = Number(sales._sum.totalAmount ?? 0)
  const paidAtSale = Number(sales._sum.paidAmount ?? 0)
  const repaid = Number(debtPayments._sum.amount ?? 0)
  const expensesTotal = roundMoney(expenses.reduce((acc, e) => acc + e.amount, 0))
  const cashIn = roundMoney(paidAtSale + repaid)

  const byCategory = new Map<string, number>(EXPENSE_CATEGORIES.map(c => [c, 0]))
  for (const e of expenses) {
    const key = isExpenseCategory(e.category) ? e.category : 'OTHER'
    byCategory.set(key, roundMoney((byCategory.get(key) ?? 0) + e.amount))
  }

  return {
    salesTotal: roundMoney(salesTotal),
    salesCount: sales._count._all,
    soldKg: roundQty(sales._sum.kg ?? 0),
    cashIn,
    repaid: roundMoney(repaid),
    expensesTotal,
    balance: roundMoney(cashIn - expensesTotal),
    byCategory: [...byCategory].map(([category, amount]) => ({ category, amount })),
    expenses,
    debtors: debtors.map(c => ({ id: c.id, name: c.name, phone: c.phone, debt: Number(c.debt) })),
    totalDebt: roundMoney(debtors.reduce((acc, c) => acc + Number(c.debt), 0)),
    payments: payments.map(p => ({ id: p.id, amount: Number(p.amount), customerName: p.customer.name, note: p.note, createdAt: p.createdAt })),
  }
}
