'use server'

import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { action, ActionError } from "@/lib/action"

export const addBOMItem = action(async function addBOMItem(formData: FormData) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const productId = formData.get("productId") as string
  const materialId = formData.get("materialId") as string
  const quantityNeeded = parseFloat(formData.get("quantityNeeded") as string)

  if (!productId || !materialId || !quantityNeeded || quantityNeeded <= 0) {
    throw new ActionError("Ma'lumotlar to'liq emas")
  }

  // Mahsulot shu tashkilotga tegishligini tekshirish
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId: orgId, isRawMaterial: false }
  })
  if (!product) throw new ActionError("Tayyor mahsulot topilmadi")

  // Xomashyo shu tashkilotga tegishligini tekshirish
  const material = await prisma.product.findFirst({
    where: { id: materialId, organizationId: orgId, isRawMaterial: true }
  })
  if (!material) throw new ActionError("Xomashyo topilmadi yoki ruxsat yo'q")

  await prisma.bom.create({
    data: { productId, materialId, quantityNeeded }
  })
  revalidatePath("/inventory")
  revalidatePath("/production")
})

export const deleteBOMItem = action(async function deleteBOMItem(id: string) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')

  // BOM shu tashkilotga tegishligini tekshirish
  const bom = await prisma.bom.findFirst({
    where: { id },
    include: { product: { select: { organizationId: true } } }
  })

  if (!bom || bom.product.organizationId !== orgId) {
    throw new ActionError("Ruxsat yo'q")
  }

  await prisma.bom.delete({ where: { id } })
  revalidatePath("/inventory")
  revalidatePath("/production")
})
