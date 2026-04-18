'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

const TEMP_ORG_ID = 'default-org-id'

export async function getMaterials() {
  return await prisma.rawMaterial.findMany({
    where: { organizationId: TEMP_ORG_ID },
    orderBy: { name: 'asc' }
  })
}

export async function createMaterial(formData: FormData) {
  const name = formData.get('name') as string
  const unit = formData.get('unit') as any
  const price = parseFloat(formData.get('price') as string)

  await prisma.rawMaterial.create({
    data: {
      name,
      unit,
      pricePerUnit: price,
      organizationId: TEMP_ORG_ID
    }
  })
  revalidatePath('/materials')
}

export async function addBOMItem(formData: FormData) {
  const productId = formData.get('productId') as string
  const materialId = formData.get('materialId') as string
  const quantityNeeded = parseFloat(formData.get('quantityNeeded') as string)

  await prisma.bomItem.create({
    data: {
      productId,
      materialId,
      quantityNeeded
    }
  })
  revalidatePath('/production/setup')
}
