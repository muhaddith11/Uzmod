'use server'

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/session"
import { action, ActionError } from "@/lib/action"
import { fields, parseForm } from "@/lib/validation"
import { roundMoney } from "@/lib/domain/costing"
import { EXPENSE_CATEGORIES } from "@/lib/domain/expenses"
import { parseDateRange, type DateRangeParams } from "@/lib/tz"
import { getT } from "@/i18n/server"

function revalidateFinance() {
  revalidatePath("/finance")
  revalidatePath("/reports")
}

export async function getExpenses(range: DateRangeParams = {}) {
  const { organizationId: orgId } = await requireRole('ADMIN')
  const createdAt = parseDateRange(range)
  const expenses = await prisma.expense.findMany({
    where: { organizationId: orgId, ...(createdAt ? { createdAt } : {}) },
    include: {
      createdBy: { select: { name: true, email: true } },
      employee: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' }
  })
  return expenses.map(e => ({
    id: e.id,
    amount: Number(e.amount),
    category: e.category,
    note: e.note,
    employeeName: e.employee ? (e.employee.name ?? e.employee.email) : null,
    createdByName: e.createdBy?.name ?? e.createdBy?.email ?? null,
    createdAt: e.createdAt,
  }))
}

/** Xarajat: sex xarajati, ish haqi (xodim tanlanadi), ip xaridi yoki boshqa */
export const createExpense = action(async function createExpense(formData: FormData) {
  const me = await requireRole('ADMIN')
  const t = await getT()
  const f = fields(t)
  const input = parseForm(z.object({
    amount: f.positive(t.finance.amount),
    category: f.oneOf(t.finance.category, EXPENSE_CATEGORIES),
    employeeId: f.optionalId(),
    note: f.optionalText(t.common.note),
  }), formData)

  let employeeId: string | null = null
  if (input.category === 'SALARY' && input.employeeId) {
    const employee = await prisma.user.findFirst({
      where: { id: input.employeeId, organizationId: me.organizationId },
      select: { id: true },
    })
    if (!employee) throw new ActionError(t.errors.workerNotFound)
    employeeId = employee.id
  }

  await prisma.expense.create({
    data: {
      amount: roundMoney(input.amount),
      category: input.category,
      employeeId,
      note: input.note ?? null,
      createdById: me.id,
      organizationId: me.organizationId
    }
  })
  revalidateFinance()
})

export const deleteExpense = action(async function deleteExpense(id: string) {
  const { organizationId: orgId } = await requireRole('ADMIN')
  const t = await getT()
  const { count } = await prisma.expense.deleteMany({ where: { id, organizationId: orgId } })
  if (count === 0) throw new ActionError(t.errors.recordNotFound)
  revalidateFinance()
})
