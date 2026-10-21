'use server'

import { prisma } from "@/lib/prisma"
import { getOrgId, requireRole } from "@/lib/session"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"

/**
 * Tashkilotdagi barcha xodimlar (ro'yxat uchun). passwordHash sahifaga tushmasligi
 * uchun faqat kerakli maydonlar olinadi.
 */
export async function getStaff() {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  return await prisma.user.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, email: true, role: true, telegramId: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }]
  })
}

/**
 * Yangi xodim qo'shadi. Xodim email+parol bilan kiradi, so'ng Profil sahifasidan
 * Telegram'ini ulaydi. Menejer faqat ishchi qo'sha oladi — menejer tayinlash adminda.
 */
export async function createEmployee(formData: FormData) {
  const { organizationId: orgId, role: myRole } = await requireRole('ADMIN', 'MANAGER')
  const name = (formData.get("name") as string)?.trim()
  const email = (formData.get("email") as string)?.trim()
  const password = formData.get("password") as string
  const role = formData.get("role") as string

  if (!name || !email || !password) throw new Error("Barcha maydonlarni to'ldiring")

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) throw new Error("Email manzil noto'g'ri formatda")
  if (password.length < 6) throw new Error("Parol kamida 6 ta belgidan iborat bo'lishi kerak")

  if (role !== 'WORKER' && role !== 'MANAGER') throw new Error("Noto'g'ri lavozim")
  if (role === 'MANAGER' && myRole !== 'ADMIN') {
    throw new Error("Menejerni faqat admin qo'sha oladi")
  }

  try {
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role,
        organizationId: orgId
      }
    })
  } catch (error: any) {
    if (error.code === 'P2002') {
      throw new Error("Ushbu email bilan foydalanuvchi mavjud")
    }
    throw error
  }

  revalidatePath("/workers")
  revalidatePath("/production")
}

export async function getWorkers() {
  const orgId = await getOrgId()
  return await prisma.user.findMany({
    where: { organizationId: orgId, role: 'WORKER' },
    include: {
      adjustments: true,
      movements: {
        where: { type: 'PRODUCTION', quantity: { gt: 0 } },
        include: { product: true }
      }
    },
    orderBy: { name: 'asc' }
  })
}

export async function addAdjustment(formData: FormData) {
  // Bonus/jarima — faqat rahbariyat huquqi. Aks holda ishchi o'ziga bonus yozib oladi.
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const userId = formData.get("userId") as string
  const amount = parseFloat(formData.get("amount") as string)
  const type = formData.get("type") as 'BONUS' | 'PENALTY'
  const note = formData.get("note") as string

  if (!userId || !type) throw new Error("Ma'lumotlar to'liq emas")
  if (isNaN(amount) || amount <= 0) throw new Error("Summa 0 dan katta bo'lishi kerak")
  if (type !== 'BONUS' && type !== 'PENALTY') throw new Error("Noto'g'ri amal turi")

  // Xodim shu tashkilotga tegishligini tekshirish
  const worker = await prisma.user.findFirst({
    where: { id: userId, organizationId: orgId }
  })
  if (!worker) throw new Error("Xodim topilmadi yoki ruxsat yo'q")

  await prisma.staffAdjustment.create({
    data: {
      userId,
      amount: type === 'BONUS' ? Math.abs(amount) : -Math.abs(amount),
      type,
      note,
      organizationId: orgId
    }
  })

  revalidatePath("/workers")
}

export async function deleteAdjustment(id: string) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  await prisma.staffAdjustment.delete({
    where: { id, organizationId: orgId }
  })
  revalidatePath("/workers")
}
