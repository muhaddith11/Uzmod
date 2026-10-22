'use server'

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/session"
import { action, ActionError } from "@/lib/action"
import { fields, parseForm } from "@/lib/validation"
import { serializable } from "@/lib/db"
import { roundMoney } from "@/lib/domain/costing"
import { formatMoney } from "@/lib/format"
import { getLocale, getT } from "@/i18n/server"

export async function getCustomers(limit = 500) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const customers = await prisma.customer.findMany({
    where: { organizationId: orgId },
    orderBy: { name: 'asc' },
    take: limit
  })
  return customers.map(c => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    debt: Number(c.debt),
    createdAt: c.createdAt,
  }))
}

export const createCustomer = action(async function createCustomer(formData: FormData) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const f = fields(t)
  const input = parseForm(z.object({
    name: f.text(t.customers.name, 150),
    phone: f.optionalText(t.common.phone, 40),
  }), formData)

  await prisma.customer.create({
    data: { name: input.name, phone: input.phone ?? null, organizationId: orgId }
  })
  revalidatePath("/customers")
  revalidatePath("/sales")
})

/**
 * Mijoz qarzini to'lashni qayd etadi.
 * Qarz faqat shu yerda (va sotuv bekor qilinganda) kamayadi — sotuvda oshadi.
 */
export const repayDebt = action(async function repayDebt(formData: FormData) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const locale = await getLocale()
  const f = fields(t)
  const C = t.customers
  const input = parseForm(z.object({
    customerId: f.id(t.common.customer),
    amount: f.positive(C.repayAmount),
    note: f.optionalText(t.common.note),
  }), formData)
  const amount = roundMoney(input.amount)

  await serializable(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: input.customerId, organizationId: me.organizationId }
    })
    if (!customer) throw new ActionError(t.errors.customerNotFound)

    const currentDebt = Number(customer.debt)
    if (currentDebt <= 0) throw new ActionError(C.noDebtToRepay)
    if (amount > currentDebt) throw new ActionError(C.repayTooMuch(formatMoney(currentDebt, locale)))

    await tx.customer.update({
      where: { id: customer.id },
      data: { debt: { decrement: amount } }
    })

    // Qarz to'lovi — pul kirimi; mahsulotsiz to'lov sifatida qayd etiladi
    await tx.debtPayment.create({
      data: {
        amount,
        note: input.note ?? null,
        customerId: customer.id,
        createdById: me.id,
        organizationId: me.organizationId
      }
    })
  })

  revalidatePath("/customers")
  revalidatePath("/reports")
  revalidatePath("/finance")
  revalidatePath("/sales")
})

export async function getDebtPayments(limit = 100) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const payments = await prisma.debtPayment.findMany({
    where: { organizationId: orgId },
    include: { customer: { select: { name: true } }, createdBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit
  })
  return payments.map(p => ({
    id: p.id,
    amount: Number(p.amount),
    note: p.note,
    customerName: p.customer.name,
    createdByName: p.createdBy?.name ?? p.createdBy?.email ?? null,
    createdAt: p.createdAt,
  }))
}

export const deleteCustomer = action(async function deleteCustomer(id: string) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const locale = await getLocale()

  const customer = await prisma.customer.findFirst({ where: { id, organizationId: orgId } })
  if (!customer) throw new ActionError(t.errors.customerNotFound)

  const debt = Number(customer.debt)
  if (Math.abs(debt) >= 0.01) {
    throw new ActionError(t.customers.cannotDeleteWithDebt(formatMoney(debt, locale)))
  }

  await prisma.customer.delete({ where: { id: customer.id } })
  revalidatePath("/customers")
})
