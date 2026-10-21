'use server'

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getOrgId, requireRole } from "@/lib/session"
import { action, ActionError } from "@/lib/action"
import { fields, parseForm } from "@/lib/validation"
import { serializable } from "@/lib/db"
import { roundMoney } from "@/lib/domain/costing"
import { formatMoney } from "@/lib/format"
import { getLocale, getT } from "@/i18n/server"

/** Kirim formalaridagi tanlov uchun — qisqa ro'yxat */
export async function getSupplierOptions() {
  const orgId = await getOrgId()
  return await prisma.supplier.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  })
}

export async function getSuppliers() {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const suppliers = await prisma.supplier.findMany({
    where: { organizationId: orgId },
    orderBy: { name: 'asc' }
  })
  return suppliers.map(s => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    note: s.note,
    debt: Number(s.debt),
  }))
}

export async function getSupplierActivity(limit = 100) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const [purchases, payments] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { organizationId: orgId, type: 'IN', supplierId: { not: null } },
      include: {
        supplier: { select: { name: true } },
        product: { select: { name: true, unit: true } },
        creator: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    }),
    prisma.supplierPayment.findMany({
      where: { organizationId: orgId },
      include: { supplier: { select: { name: true } }, createdBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit
    })
  ])
  return {
    purchases: purchases.map(m => ({
      id: m.id,
      supplierName: m.supplier?.name ?? null,
      productName: m.product.name,
      unit: m.product.unit,
      quantity: m.quantity,
      unitCost: Number(m.unitCost ?? 0),
      total: roundMoney(m.quantity * Number(m.unitCost ?? 0)),
      createdByName: m.creator?.name ?? m.creator?.email ?? null,
      createdAt: m.createdAt,
    })),
    payments: payments.map(p => ({
      id: p.id,
      supplierName: p.supplier.name,
      amount: Number(p.amount),
      note: p.note,
      createdByName: p.createdBy?.name ?? p.createdBy?.email ?? null,
      createdAt: p.createdAt,
    })),
  }
}

export const createSupplier = action(async function createSupplier(formData: FormData) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const f = fields(t)
  const input = parseForm(z.object({
    name: f.text(t.suppliers.name, 150),
    phone: f.optionalText(t.common.phone, 40),
    note: f.optionalText(t.suppliers.note, 500),
  }), formData)

  await prisma.supplier.create({
    data: { name: input.name, phone: input.phone ?? null, note: input.note ?? null, organizationId: orgId }
  })
  revalidatePath("/suppliers")
})

export const paySupplier = action(async function paySupplier(formData: FormData) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const locale = await getLocale()
  const f = fields(t)
  const S = t.suppliers
  const input = parseForm(z.object({
    supplierId: f.id(t.common.supplier),
    amount: f.positive(S.payAmount),
    note: f.optionalText(t.common.note),
  }), formData)
  const amount = roundMoney(input.amount)

  await serializable(async (tx) => {
    const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, organizationId: me.organizationId } })
    if (!supplier) throw new ActionError(t.errors.supplierNotFound)
    const debt = Number(supplier.debt)
    if (debt <= 0) throw new ActionError(S.noDebtToPay)
    if (amount > debt) throw new ActionError(S.payTooMuch(formatMoney(debt, locale)))

    await tx.supplier.update({ where: { id: supplier.id }, data: { debt: { decrement: amount } } })
    await tx.supplierPayment.create({
      data: {
        amount,
        note: input.note ?? null,
        supplierId: supplier.id,
        createdById: me.id,
        organizationId: me.organizationId,
      }
    })
  })

  revalidatePath("/suppliers")
  revalidatePath("/reports")
})

export const deleteSupplier = action(async function deleteSupplier(id: string) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const locale = await getLocale()

  const supplier = await prisma.supplier.findFirst({ where: { id, organizationId: orgId } })
  if (!supplier) throw new ActionError(t.errors.supplierNotFound)
  const debt = Number(supplier.debt)
  if (Math.abs(debt) >= 0.01) throw new ActionError(t.suppliers.cannotDeleteWithDebt(formatMoney(debt, locale)))

  await prisma.supplier.delete({ where: { id: supplier.id } })
  revalidatePath("/suppliers")
})
