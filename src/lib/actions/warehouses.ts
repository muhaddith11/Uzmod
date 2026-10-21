'use server'

import { prisma } from "@/lib/prisma"
import { getOrgId, requireRole } from "@/lib/session"
import { revalidatePath } from "next/cache"

export async function getWarehouses() {
  const orgId = await getOrgId()
  return await prisma.warehouse.findMany({
    where: { organizationId: orgId },
    orderBy: { name: 'asc' }
  })
}

export async function createWarehouse(formData: FormData) {
  const { organizationId: orgId } = await requireRole('ADMIN')
  const name = formData.get("name") as string
  const address = formData.get("address") as string

  if (!name?.trim()) throw new Error("Ombor nomi majburiy")

  await prisma.warehouse.create({
    data: {
      name,
      address,
      organizationId: orgId
    }
  })
  revalidatePath("/warehouses")
}

export async function deleteWarehouse(id: string) {
  const { organizationId: orgId } = await requireRole('ADMIN')

  // Ombor shu tashkilotga tegishligini tekshirish
  const warehouse = await prisma.warehouse.findFirst({
    where: { id, organizationId: orgId }
  })
  if (!warehouse) throw new Error("Ombor topilmadi yoki ruxsat yo'q")

  // Ichida stock borligini tekshirish
  const stockWithGoods = await prisma.stockLevel.findFirst({
    where: { warehouseId: id, quantity: { gt: 0 } }
  })
  if (stockWithGoods) {
    throw new Error("Omborda mahsulot bor. Avval omborni bo'shatib, so'ng o'chiring.")
  }

  // Rulonlar Roll.warehouse orqali cascade o'chadi — vazni qolganlarini yo'qotib
  // qo'ymaslik uchun alohida tekshiramiz.
  const rollsLeft = await prisma.roll.findFirst({
    where: { warehouseId: id, status: { not: 'FINISHED' } }
  })
  if (rollsLeft) {
    throw new Error("Omborda tugallanmagan rulonlar bor. Avval ularni ko'chiring yoki yoping.")
  }

  await prisma.warehouse.delete({
    where: { id, organizationId: orgId }
  })
  revalidatePath("/warehouses")
}
