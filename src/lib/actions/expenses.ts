'use server'

import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/session"
import { revalidatePath } from "next/cache"

export async function getExpenses() {
  const { organizationId: orgId } = await requireRole('ADMIN')
  return await prisma.expense.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' }
  })
}

export async function createExpense(formData: FormData) {
  const { organizationId: orgId } = await requireRole('ADMIN')
  const amount = parseFloat(formData.get("amount") as string)
  const category = formData.get("category") as string
  const note = formData.get("note") as string

  if (!category) throw new Error("Ma'lumotlar to'liq emas")
  if (isNaN(amount) || amount <= 0) throw new Error("Summa 0 dan katta bo'lishi kerak")

  await prisma.expense.create({
    data: {
      amount,
      category,
      note,
      organizationId: orgId
    }
  })

  revalidatePath("/finance")
}

export async function deleteExpense(id: string) {
  const { organizationId: orgId } = await requireRole('ADMIN')
  await prisma.expense.delete({
    where: { id, organizationId: orgId }
  })
  revalidatePath("/finance")
}
