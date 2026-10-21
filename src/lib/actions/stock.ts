'use server'

import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { action, ActionError } from "@/lib/action"

export const stockIn = action(async function stockIn(formData: FormData) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const productId = formData.get("productId") as string
  const warehouseId = formData.get("warehouseId") as string
  const quantity = parseFloat(formData.get("quantity") as string)
  const note = formData.get("note") as string

  if (!productId || !warehouseId) throw new ActionError("Ma'lumotlar to'liq emas")
  if (!quantity || quantity <= 0) throw new ActionError("Miqdor 0 dan katta bo'lishi kerak")

  const [product, warehouse] = await Promise.all([
    prisma.product.findFirst({ where: { id: productId, organizationId: orgId } }),
    prisma.warehouse.findFirst({ where: { id: warehouseId, organizationId: orgId } })
  ])
  if (!product) throw new ActionError("Mahsulot topilmadi yoki ruxsat yo'q")
  if (!warehouse) throw new ActionError("Ombor topilmadi yoki ruxsat yo'q")

  await prisma.$transaction(async (tx) => {
    // 1. StockLevel-ni yangilash yoki yaratish
    await tx.stockLevel.upsert({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId,
        }
      },
      update: {
        quantity: { increment: quantity }
      },
      create: {
        productId,
        warehouseId,
        quantity,
      }
    })

    // 2. Tranzaksiyani yozish
    await tx.stockMovement.create({
      data: {
        type: 'IN',
        quantity,
        productId,
        toWarehouseId: warehouseId,
        organizationId: orgId,
        note
      }
    })
  })

  revalidatePath("/inventory")
  revalidatePath("/movements")
})

export const stockAdjust = action(async function stockAdjust(formData: FormData) {
  // Brak/inventarizatsiya qoldiqni o'zgartiradi — faqat rahbariyat huquqi
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const productId = formData.get("productId") as string
  const warehouseId = formData.get("warehouseId") as string
  const quantity = parseFloat(formData.get("quantity") as string)
  const type = formData.get("type") as any // 'WASTAGE' | 'REVISION' | 'ADJUSTMENT'
  const note = formData.get("note") as string

  if (!productId || !warehouseId || isNaN(quantity) || !type || !note) {
    throw new ActionError("Ma'lumotlar to'liq emas. Izoh qoldirish majburiy!")
  }

  const [adjProduct, adjWarehouse] = await Promise.all([
    prisma.product.findFirst({ where: { id: productId, organizationId: orgId } }),
    prisma.warehouse.findFirst({ where: { id: warehouseId, organizationId: orgId } })
  ])
  if (!adjProduct) throw new ActionError("Mahsulot topilmadi yoki ruxsat yo'q")
  if (!adjWarehouse) throw new ActionError("Ombor topilmadi yoki ruxsat yo'q")

  await prisma.$transaction(async (tx) => {
    // Serializable isolation: parallel so'rovlar qoldiqni manfiyga tushirolmaydi
    await tx.$executeRaw`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`

    const currentStock = await tx.stockLevel.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } }
    })

    let diff = quantity

    if (type === 'REVISION') {
      // REVISION holatida 'quantity' - bu yangi real miqdor. 
      // Biz farqni (diff) hisoblab auditga yozamiz.
      diff = quantity - (currentStock?.quantity || 0)
      
      await tx.stockLevel.upsert({
        where: { productId_warehouseId: { productId, warehouseId } },
        update: { quantity: quantity },
        create: { productId, warehouseId, quantity }
      })
    } else {
      // WASTAGE yoki ADJUSTMENT holatida 'quantity' - bu o'zgarish miqdori (odatda manfiy)
      if (!currentStock || currentStock.quantity === 0) {
        throw new ActionError("Omborda mahsulot yo'q")
      }

      const newQuantity = (currentStock?.quantity || 0) + quantity
      if (newQuantity < 0) {
        throw new ActionError(
          `Omborda yetarli mahsulot yo'q. Mavjud: ${currentStock?.quantity ?? 0}`
        )
      }

      await tx.stockLevel.upsert({
        where: { productId_warehouseId: { productId, warehouseId } },
        update: { quantity: { increment: quantity } },
        create: { productId, warehouseId, quantity }
      })
    }

    // Harakatlar tarixiga yozish
    await tx.stockMovement.create({
      data: {
        type,
        quantity: diff,
        productId,
        // Wastage odatda chiqim hisoblanadi
        fromWarehouseId: diff < 0 ? warehouseId : null,
        toWarehouseId: diff > 0 ? warehouseId : null,
        organizationId: orgId,
        note: `[${type}] ${note}`
      }
    })
  })

  // Ogohlantirishlarni tekshirish
  const { checkLowStock } = await import("@/lib/alerts")
  await checkLowStock(productId, orgId)

  revalidatePath("/inventory")
  revalidatePath("/movements")
})
