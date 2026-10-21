'use server'

import { prisma } from "@/lib/prisma"
import { getOrgId } from "@/lib/session"
import { revalidatePath } from "next/cache"

// Rulon qabuli — ishchi ham bajara oladi (sexda kundalik ish)
export async function createRolls(formData: FormData) {
  const orgId = await getOrgId()
  const productId = formData.get("productId") as string
  const warehouseId = formData.get("warehouseId") as string
  const weightsString = formData.get("weights") as string // "25.4, 26.1, 24.8"
  
  if (!productId || !warehouseId || !weightsString) {
    throw new Error("Barcha ma'lumotlarni kiriting")
  }

  const [product, warehouse] = await Promise.all([
    prisma.product.findFirst({ where: { id: productId, organizationId: orgId } }),
    prisma.warehouse.findFirst({ where: { id: warehouseId, organizationId: orgId } })
  ])
  if (!product) throw new Error("Mahsulot topilmadi yoki ruxsat yo'q")
  if (!warehouse) throw new Error("Ombor topilmadi yoki ruxsat yo'q")

  const parsed = weightsString.split(/[,\s]+/).filter(w => w.length > 0).map(w => parseFloat(w))
  if (parsed.some(w => isNaN(w) || w <= 0)) {
    throw new Error("Har bir rulon vazni 0 dan katta son bo'lishi kerak")
  }
  const weights = parsed
  if (weights.length === 0) {
    throw new Error("Kamida bitta rulon vaznini kiriting")
  }
  const totalWeight = weights.reduce((acc, w) => acc + w, 0)

  await prisma.$transaction(async (tx) => {
    // 1. Har bir rulonni alohida yaratish
    for (const w of weights) {
      await tx.roll.create({
        data: {
          productId,
          warehouseId,
          initialWeight: w,
          currentWeight: w,
          organizationId: orgId
        }
      })
    }

    // 2. Umumiy stockni yangilash
    await tx.stockLevel.upsert({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId,
        }
      },
      update: {
        quantity: { increment: totalWeight }
      },
      create: {
        productId,
        warehouseId,
        quantity: totalWeight,
      }
    })

    // 3. Harakat tarixiga yozish
    await tx.stockMovement.create({
      data: {
        type: 'IN',
        quantity: totalWeight,
        productId,
        toWarehouseId: warehouseId,
        organizationId: orgId,
        note: `Partiya rulonlari qabul qilindi: ${weights.length} ta rulon, jami ${totalWeight} kg.`
      }
    })
  })

  revalidatePath("/inventory")
}

export async function getRolls(productId?: string) {
  const orgId = await getOrgId()
  return await prisma.roll.findMany({
    where: {
      organizationId: orgId,
      ...(productId ? { productId } : {}),
      status: { not: 'FINISHED' }
    },
    include: { product: true, warehouse: true },
    orderBy: { createdAt: 'desc' }
  })
}

/**
 * Ishlab chiqarish formasi uchun: tanlangan mahsulot resepti (BOM) dagi
 * rulonli xomashyolar va ularning ishlatishga tayyor rulonlari.
 */
export async function getRollOptionsForProduct(productId: string, warehouseId: string) {
  const orgId = await getOrgId()

  const bom = await prisma.bom.findMany({
    where: { productId, product: { organizationId: orgId } },
    include: { material: true }
  })

  const rollTracked = bom.filter(item => item.material.isRollTracked)
  if (rollTracked.length === 0) return []

  const rolls = await prisma.roll.findMany({
    where: {
      organizationId: orgId,
      warehouseId,
      productId: { in: rollTracked.map(i => i.materialId) },
      status: { not: 'FINISHED' },
      currentWeight: { gt: 0 }
    },
    orderBy: { createdAt: 'asc' }
  })

  return rollTracked.map(item => ({
    materialId: item.materialId,
    materialName: item.material.name,
    unit: item.material.unit,
    quantityNeeded: item.quantityNeeded,
    rolls: rolls
      .filter(r => r.productId === item.materialId)
      .map(r => ({
        id: r.id,
        currentWeight: r.currentWeight,
        initialWeight: r.initialWeight,
        status: r.status
      }))
  }))
}

/**
 * Rulonni qo'lda yopish (masalan, qoldig'i brak bo'lib chiqsa).
 */
export async function finishRoll(id: string) {
  const orgId = await getOrgId()

  const roll = await prisma.roll.findFirst({
    where: { id, organizationId: orgId }
  })
  if (!roll) throw new Error("Rulon topilmadi yoki ruxsat yo'q")
  if (roll.status === 'FINISHED') throw new Error("Rulon allaqachon yopilgan")

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`

    // Rulonda qolgan vazn omborda ham hisobdan chiqadi — aks holda umumiy
    // qoldiq rulonlar yig'indisidan katta bo'lib qoladi.
    if (roll.currentWeight > 0) {
      await tx.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: roll.productId,
            warehouseId: roll.warehouseId
          }
        },
        data: { quantity: { decrement: roll.currentWeight } }
      })

      await tx.stockMovement.create({
        data: {
          type: 'WASTAGE',
          quantity: -roll.currentWeight,
          productId: roll.productId,
          fromWarehouseId: roll.warehouseId,
          rollId: roll.id,
          organizationId: orgId,
          note: `[WASTAGE] Rulon qo'lda yopildi, qoldiq: ${roll.currentWeight}`
        }
      })
    }

    await tx.roll.update({
      where: { id: roll.id },
      data: { currentWeight: 0, status: 'FINISHED' }
    })
  })

  revalidatePath("/inventory")
  revalidatePath("/production")
}
