'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

async function getOrgId() {
  const session = await auth()
  if (!session?.user) throw new Error("Avtorizatsiya kerak")
  return (session.user as any).organizationId
}

export async function getMaterials() {
  const orgId = await getOrgId()
  return await prisma.product.findMany({
    where: { 
      organizationId: orgId,
      isRawMaterial: true 
    },
    orderBy: { name: 'asc' }
  })
}

export async function createMaterial(formData: FormData) {
  const orgId = await getOrgId()
  const name = formData.get('name') as string
  const unit = formData.get('unit') as string
  const price = parseFloat(formData.get('price') as string || "0")

  if (!name?.trim()) throw new Error("Xomashyo nomini kiriting")
  if (isNaN(price) || price < 0) throw new Error("Narx noto'g'ri kiritilgan")

  await prisma.product.create({
    data: {
      name,
      unit,
      price,
      // Xomashyo uchun sotib olish narxi ayni paytda tannarx hisoblanadi.
      // BOM orqali tayyor mahsulot tannarxi shu qiymatdan hisoblanadi.
      costPrice: price,
      isRawMaterial: true,
      organizationId: orgId
    }
  })
  revalidatePath('/inventory')
}
