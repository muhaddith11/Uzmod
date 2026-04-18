'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// Masalan, bizda bitta doimiy tashkilot ID bor (SaaS mantiqi uchun)
const TEMP_ORG_ID = 'default-org-id'

export async function ensureOrganization() {
  const org = await prisma.organization.findUnique({
    where: { id: TEMP_ORG_ID }
  })
  if (!org) {
    await prisma.organization.create({
      data: {
        id: TEMP_ORG_ID,
        name: 'Mening Sexim'
      }
    })
  }
}

export async function getProducts() {
  await ensureOrganization()
  return await prisma.product.findMany({
    where: { organizationId: TEMP_ORG_ID },
    orderBy: { name: 'asc' }
  })
}

export async function createProduct(formData: FormData) {
  await ensureOrganization()
  const name = formData.get('name') as string
  const sku = formData.get('sku') as string
  const price = parseFloat(formData.get('price') as string)

  await prisma.product.create({
    data: {
      name,
      sku,
      price,
      organizationId: TEMP_ORG_ID
    }
  })

  revalidatePath('/inventory')
}

export async function deleteProduct(id: string) {
  await prisma.product.delete({
    where: { id }
  })
  revalidatePath('/inventory')
}
