'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function produceProduct(formData: FormData) {
  const productId = formData.get('productId') as string
  const quantityProduced = parseFloat(formData.get('quantityProduced') as string)

  // 1. BOM tarkibini olish
  const bom = await prisma.bomItem.findMany({
    where: { productId },
    include: { material: true }
  })

  if (bom.length === 0) {
    throw new Error("Ushbu mahsulot uchun xomashyo tarkibi (BOM) belgilanmagan!")
  }

  // 2. Xomashyo yetarliligini tekshirish
  for (const item of bom) {
    const needed = item.quantityNeeded * quantityProduced
    if (item.material.quantity < needed) {
      throw new Error(`Xomashyo yetarli emas: ${item.material.name}. Kerak: ${needed}, Mavjud: ${item.material.quantity}`)
    }
  }

  // 3. Tranzaksiya: Xomashyolarni kamaytirish va tayyor mahsulotni ko'paytirish
  await prisma.$transaction(async (tx) => {
    // Xariq xomashyolarni kamaytirish
    for (const item of bom) {
      const needed = item.quantityNeeded * quantityProduced
      await tx.rawMaterial.update({
        where: { id: item.materialId },
        data: { quantity: { decrement: needed } }
      })
      
      // Tranzaksiya tarixiga yozish (Out)
      await tx.stockTransaction.create({
        data: {
          materialId: item.materialId,
          type: 'PRODUCTION',
          quantity: -needed,
          note: `Ishlab chiqarish uchun ishlatildi (Mahsulot ID: ${productId})`
        }
      })
    }

    // Tayyor mahsulotni ko'paytirish
    await tx.product.update({
      where: { id: productId },
      data: { quantity: { increment: quantityProduced } }
    })

    // Tayyor mahsulot tranzaksiyasiga yozish (In)
    await tx.stockTransaction.create({
      data: {
        productId,
        type: 'PRODUCTION',
        quantity: quantityProduced,
        note: `Ishlab chiqarishdan kirdi`
      }
    })

    // Ishlab chiqarish logiga yozish
    await tx.productionLog.create({
      data: {
        productId,
        quantityProduced,
        costValue: 0, // Tannarx hisoblash mantiqini keyinroq qo'shish mumkin
      }
    })
  })

  revalidatePath('/inventory')
  revalidatePath('/production')
}

export async function getProductionLogs() {
  return await prisma.productionLog.findMany({
    include: { product: true },
    orderBy: { createdAt: 'desc' }
  })
}
