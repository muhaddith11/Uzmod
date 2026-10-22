'use server'

import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getOrgId, requireRole, type SessionUser } from "@/lib/session"
import { action, ActionError } from "@/lib/action"
import { fields, parseForm } from "@/lib/validation"
import { getT } from "@/i18n/server"
import { parseDateRange, type DateRangeParams } from "@/lib/tz"
import { relinkPunches } from "@/lib/device-attendance"

/**
 * Tashkilotdagi barcha xodimlar (boshqaruv ro'yxati uchun). passwordHash sahifaga
 * tushmasligi uchun faqat kerakli maydonlar olinadi.
 */
export async function getStaff() {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  return await prisma.user.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, email: true, role: true, telegramId: true, isActive: true, deviceUserId: true },
    orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { name: 'asc' }]
  })
}

/** Ishlab chiqarish formasidagi ro'yxat — faqat faol ishchilar */
export async function getActiveWorkers() {
  const orgId = await getOrgId()
  return await prisma.user.findMany({
    where: { organizationId: orgId, role: 'WORKER', isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' }
  })
}

/**
 * Ishchilar va tanlangan davrdagi ishbay ishlari hamda bonus/jarimalari.
 * Ish haqi harakatdagi `unitWage` (o'sha paytdagi narx) bo'yicha — keyin narx
 * o'zgarsa ham o'tgan oylar hisobi o'zgarmaydi.
 */
export async function getWorkerEarnings(range: DateRangeParams) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const createdAt = parseDateRange(range)
  const dateWhere = createdAt ? { createdAt } : {}

  const workers = await prisma.user.findMany({
    where: { organizationId: orgId, role: 'WORKER' },
    select: {
      id: true, name: true, email: true, isActive: true,
      adjustments: { where: dateWhere, orderBy: { createdAt: 'desc' } },
      movements: {
        where: { type: 'PRODUCTION', quantity: { gt: 0 }, ...dateWhere },
        include: { product: { select: { name: true, unit: true, productionWage: true } } },
        orderBy: { createdAt: 'desc' }
      }
    },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }]
  })

  return workers.map(w => {
    const work = w.movements.map(m => {
      const wage = Number(m.unitWage ?? m.product.productionWage ?? 0)
      return {
        id: m.id,
        productName: m.product.name,
        unit: m.product.unit,
        quantity: m.quantity,
        earned: m.quantity * wage,
        createdAt: m.createdAt,
      }
    })
    const adjustments = w.adjustments.map(a => ({
      id: a.id,
      amount: Number(a.amount),
      type: a.type,
      note: a.note,
      createdAt: a.createdAt,
    }))
    const pieceTotal = work.reduce((acc, m) => acc + m.earned, 0)
    const adjustmentTotal = adjustments.reduce((acc, a) => acc + a.amount, 0)
    return {
      id: w.id,
      name: w.name,
      email: w.email,
      isActive: w.isActive,
      work,
      adjustments,
      pieceTotal,
      adjustmentTotal,
      balance: pieceTotal + adjustmentTotal,
    }
  })
}

/**
 * Xodim qo'shadi. Xodim email+parol bilan kiradi, so'ng Profil sahifasidan
 * Telegram'ini ulaydi. Menejer faqat ishchi qo'sha oladi — menejer tayinlash adminda.
 */
export const createEmployee = action(async function createEmployee(formData: FormData) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const f = fields(t)
  const input = parseForm(z.object({
    name: f.text(t.workers.fullName, 100),
    email: f.email(),
    password: f.newPassword(),
    role: f.oneOf(t.workers.role, ['WORKER', 'MANAGER'] as const),
  }), formData)

  if (input.role === 'MANAGER' && me.role !== 'ADMIN') {
    throw new ActionError(t.workers.onlyAdminAddsManager)
  }

  const exists = await prisma.user.findFirst({
    where: { email: { equals: input.email, mode: 'insensitive' } },
    select: { id: true }
  })
  if (exists) throw new ActionError(t.errors.emailTaken)

  try {
    await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, 10),
        role: input.role,
        organizationId: me.organizationId
      }
    })
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') throw new ActionError(t.errors.emailTaken)
    throw error
  }

  revalidatePath("/workers")
  revalidatePath("/production")
})

/**
 * Kim kimni boshqara oladi: o'zini — hech kim; admin — boshqa har qanday xodimni;
 * menejer — faqat ishchini.
 */
async function findManageableUser(me: SessionUser, userId: string) {
  const t = await getT()
  if (userId === me.id) throw new ActionError(t.workers.cannotManageSelf)

  const target = await prisma.user.findFirst({
    where: { id: userId, organizationId: me.organizationId },
    select: { id: true, role: true }
  })
  if (!target) throw new ActionError(t.errors.workerNotFound)
  if (me.role !== 'ADMIN' && target.role !== 'WORKER') {
    throw new ActionError(t.workers.cannotManageThis)
  }
  return target
}

export const setEmployeeActive = action(async function setEmployeeActive(userId: string, active: boolean) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const target = await findManageableUser(me, userId)

  await prisma.user.update({
    where: { id: target.id },
    data: active
      ? { isActive: true }
      // sessionVersion oshadi — xodimning barcha ochiq sessiyalari yaroqsiz bo'ladi
      : { isActive: false, sessionVersion: { increment: 1 } }
  })

  revalidatePath("/workers")
  revalidatePath("/production")
})

export const resetEmployeePassword = action(async function resetEmployeePassword(formData: FormData) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const f = fields(t)
  const input = parseForm(z.object({
    userId: f.id(t.workers.employee),
    password: f.newPassword(),
  }), formData)
  const target = await findManageableUser(me, input.userId)

  await prisma.user.update({
    where: { id: target.id },
    data: {
      passwordHash: await bcrypt.hash(input.password, 10),
      sessionVersion: { increment: 1 }
    }
  })
  revalidatePath("/workers")
})

export const changeEmployeeRole = action(async function changeEmployeeRole(formData: FormData) {
  const me = await requireRole('ADMIN')
  const t = await getT()
  const f = fields(t)
  const input = parseForm(z.object({
    userId: f.id(t.workers.employee),
    role: f.oneOf(t.workers.role, ['WORKER', 'MANAGER', 'ADMIN'] as const),
  }), formData)
  const target = await findManageableUser(me, input.userId)

  await prisma.user.update({ where: { id: target.id }, data: { role: input.role } })
  revalidatePath("/workers")
  revalidatePath("/production")
})

export const addAdjustment = action(async function addAdjustment(formData: FormData) {
  // Bonus/jarima — faqat rahbariyat huquqi. Aks holda ishchi o'ziga bonus yozib oladi.
  const me = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const f = fields(t)
  const input = parseForm(z.object({
    userId: f.id(t.workers.employee),
    amount: f.positive(t.workers.amount),
    type: f.oneOf(t.workers.adjustmentType, ['BONUS', 'PENALTY'] as const),
    note: f.optionalText(t.common.note),
  }), formData)

  const worker = await prisma.user.findFirst({
    where: { id: input.userId, organizationId: me.organizationId },
    select: { id: true }
  })
  if (!worker) throw new ActionError(t.errors.workerNotFound)

  await prisma.staffAdjustment.create({
    data: {
      userId: input.userId,
      amount: input.type === 'BONUS' ? input.amount : -input.amount,
      type: input.type,
      note: input.note,
      createdById: me.id,
      organizationId: me.organizationId
    }
  })

  revalidatePath("/workers")
})

export const deleteAdjustment = action(async function deleteAdjustment(id: string) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const { count } = await prisma.staffAdjustment.deleteMany({
    where: { id, organizationId: orgId }
  })
  if (count === 0) throw new ActionError(t.errors.recordNotFound)
  revalidatePath("/workers")
})

/**
 * Xodimning Face ID qurilmadagi raqami (User ID). Raqam berilgach, shu raqam
 * bilan avval kelgan belgilar ham davomatga o'tkaziladi. Bo'sh — raqam olib tashlanadi.
 */
export const setEmployeeDeviceId = action(async function setEmployeeDeviceId(formData: FormData) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const f = fields(t)
  const input = parseForm(z.object({
    userId: f.id(t.workers.employee),
    deviceUserId: f.optionalText(t.workers.deviceId, 20),
  }), formData)

  // Admin o'ziga ham raqam bera oladi (u ham qurilmadan o'tishi mumkin)
  const target = input.userId === me.id && me.role === 'ADMIN'
    ? { id: me.id }
    : await findManageableUser(me, input.userId)
  const pin = input.deviceUserId?.replace(/\s/g, "") || null

  try {
    await prisma.user.update({ where: { id: target.id }, data: { deviceUserId: pin } })
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') throw new ActionError(t.workers.deviceIdTaken)
    throw error
  }
  if (pin) await relinkPunches(me.organizationId, pin, target.id)

  revalidatePath("/workers")
  revalidatePath("/attendance")
  revalidatePath("/settings")
})
