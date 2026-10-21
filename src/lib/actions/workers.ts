'use server'

import { prisma } from "@/lib/prisma"
import { getOrgId, requireRole } from "@/lib/session"
import { revalidatePath } from "next/cache"

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
