'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function stockIn(formData: FormData) {
  const productId = formData.get('productId') as string
  const materialId = formData.get('materialId') as string
  const quantity = parseFloat(formData.get('quantity') as string)
  const note = formData.get('note') as string

  if (productId) {
    await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: { quantity: { increment: quantity } }
      }),
      prisma.stockTransaction.create({
        data: {
          productId,
          type: 'IN',
          quantity,
          note
        }
      })
    ])
  } else if (materialId) {
    await prisma.$transaction([
      prisma.rawMaterial.update({
        where: { id: materialId },
        data: { quantity: { increment: quantity } }
      }),
      prisma.stockTransaction.create({
        data: {
          materialId,
          type: 'IN',
          quantity,
          note
        }
      })
    ])
  }

  revalidatePath('/inventory')
  revalidatePath('/stock-in')
}
