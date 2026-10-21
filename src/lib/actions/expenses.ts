'use server'

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/session"
import { action, ActionError } from "@/lib/action"
import { fields, parseForm } from "@/lib/validation"
import { roundMoney } from "@/lib/domain/costing"
import { parseDateRange, type DateRangeParams } from "@/lib/tz"
import { getT } from "@/i18n/server"

export async function getExpenses(range: DateRangeParams = {}) {
  const { organizationId: orgId } = await requireRole('ADMIN')
  const createdAt = parseDateRange(range)
  const expenses = await prisma.expense.findMany({
    where: { organizationId: orgId, ...(createdAt ? { createdAt } : {}) },
    include: { createdBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' }
  })
  return expenses.map(e => ({
    id: e.id,
    amount: Number(e.amount),
    category: e.category,
    note: e.note,
    createdByName: e.createdBy?.name ?? e.createdBy?.email ?? null,
    createdAt: e.createdAt,
  }))
}

export const createExpense = action(async function createExpense(formData: FormData) {
  const me = await requireRole('ADMIN')
  const t = await getT()
  const f = fields(t)
  const input = parseForm(z.object({
    amount: f.positive(t.finance.amount),
    category: f.text(t.finance.category, 60),
    note: f.optionalText(t.common.note),
  }), formData)

  await prisma.expense.create({
    data: {
      amount: roundMoney(input.amount),
      category: input.category,
      note: input.note ?? null,
      createdById: me.id,
      organizationId: me.organizationId
    }
  })

  revalidatePath("/finance")
  revalidatePath("/reports")
})

export const deleteExpense = action(async function deleteExpense(id: string) {
  const { organizationId: orgId } = await requireRole('ADMIN')
  const t = await getT()
  const { count } = await prisma.expense.deleteMany({ where: { id, organizationId: orgId } })
  if (count === 0) throw new ActionError(t.errors.recordNotFound)
  revalidatePath("/finance")
  revalidatePath("/reports")
})
