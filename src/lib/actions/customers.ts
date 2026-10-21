'use server'

import { prisma } from "@/lib/prisma"
import { getOrgId, requireRole } from "@/lib/session"
import { revalidatePath } from "next/cache"

export async function getCustomers(limit = 200) {
  const orgId = await getOrgId()
  return await prisma.customer.findMany({
    where: { organizationId: orgId },
    orderBy: { name: 'asc' },
    take: limit
  })
}

export async function createCustomer(formData: FormData) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const name = formData.get("name") as string
  const phone = formData.get("phone") as string

  if (!name?.trim()) throw new Error("Ism majburiy")

  await prisma.customer.create({
    data: {
      name,
      phone,
      organizationId: orgId
    }
  })
  revalidatePath("/customers")
}

/**
 * Mijoz qarzini to'lashni qayd etadi.
 * Qarz faqat shu yerda kamayadi — sotuvda (createSale) esa oshadi.
 */
export async function repayDebt(formData: FormData) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const customerId = formData.get("customerId") as string
  const amount = parseFloat(formData.get("amount") as string)
  const note = formData.get("note") as string

  if (!customerId) throw new Error("Mijoz tanlanmagan")
  if (isNaN(amount) || amount <= 0) {
    throw new Error("To'lov summasi 0 dan katta bo'lishi kerak")
  }

  await prisma.$transaction(async (tx) => {
    // Serializable: bir vaqtda 2 ta to'lov qarzni manfiyga tushirmasligi uchun
    await tx.$executeRaw`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`

    const customer = await tx.customer.findFirst({
      where: { id: customerId, organizationId: orgId }
    })
    if (!customer) throw new Error("Mijoz topilmadi yoki ruxsat yo'q")

    const currentDebt = Number(customer.debt)
    if (currentDebt <= 0) throw new Error("Bu mijozda qarz yo'q")
    if (amount > currentDebt) {
      throw new Error(
        `To'lov qarzdan katta. Mijozning qarzi: ${new Intl.NumberFormat('uz-UZ').format(currentDebt)} so'm`
      )
    }

    await tx.customer.update({
      where: { id: customerId },
      data: { debt: { decrement: amount } }
    })

    // Qarz to'lovi — pul kirimi, shuning uchun uni Sale sifatida emas,
    // mahsulotsiz to'lov sifatida qayd etamiz.
    await tx.debtPayment.create({
      data: {
        amount,
        note,
        customerId,
        organizationId: orgId
      }
    })
  })

  revalidatePath("/customers")
  revalidatePath("/reports")
  revalidatePath("/finance")
}

export async function getDebtPayments(customerId?: string, limit = 100) {
  const orgId = await getOrgId()
  return await prisma.debtPayment.findMany({
    where: {
      organizationId: orgId,
      ...(customerId ? { customerId } : {})
    },
    include: { customer: true },
    orderBy: { createdAt: 'desc' },
    take: limit
  })
}

export async function deleteCustomer(id: string) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')

  const customer = await prisma.customer.findFirst({
    where: { id, organizationId: orgId }
  })
  if (!customer) throw new Error("Mijoz topilmadi")

  if (Number(customer.debt) > 0) {
    throw new Error(
      `Mijozda ${new Intl.NumberFormat('uz-UZ').format(Number(customer.debt))} so'm qarz bor. Avval qarzni yoping.`
    )
  }

  await prisma.customer.delete({
    where: { id, organizationId: orgId }
  })
  revalidatePath("/customers")
}
