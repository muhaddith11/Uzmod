'use server'

import { prisma } from "@/lib/prisma"
import { getOrgId, requireRole } from "@/lib/session"
import { revalidatePath } from "next/cache"
import type { PaymentType } from "@prisma/client"
import { action, ActionError } from "@/lib/action"

const PAYMENT_TYPES: PaymentType[] = ['CASH', 'CARD', 'DEBT']

export const createSale = action(async function createSale(formData: FormData) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const productId = formData.get("productId") as string
  const warehouseId = formData.get("warehouseId") as string
  const quantity = parseFloat(formData.get("quantity") as string)
  const totalAmount = parseFloat(formData.get("totalAmount") as string)
  const paidAmount = parseFloat(formData.get("paidAmount") as string)
  const paymentType = formData.get("paymentType") as PaymentType
  const customerId = formData.get("customerId") as string

  if (!productId || !warehouseId || !totalAmount) {
    throw new ActionError("Ma'lumotlar to'liq emas")
  }

  if (!quantity || quantity <= 0) {
    throw new ActionError("Miqdor 0 dan katta bo'lishi kerak")
  }

  if (isNaN(paidAmount)) {
    throw new ActionError("To'langan summa noto'g'ri kiritilgan")
  }

  if (totalAmount < 0 || paidAmount < 0) {
    throw new ActionError("Summa manfiy bo'lishi mumkin emas")
  }

  if (paidAmount > totalAmount) {
    throw new ActionError("To'langan summa jami summadan katta bo'lishi mumkin emas")
  }

  if (!PAYMENT_TYPES.includes(paymentType)) {
    throw new ActionError("Noto'g'ri to'lov turi")
  }

  if (paymentType === 'DEBT' && !customerId) {
     throw new ActionError("Nasiya uchun mijozni tanlash majburiy")
  }

  // To'lanmagan qoldiq mijoz qarziga yoziladi. Mijozsiz bu pul hech qayerda
  // qolmasdi, hisobotda esa to'liq summa daromad bo'lib ko'rinardi.
  if (paidAmount < totalAmount && !customerId) {
    throw new ActionError("Summa to'liq to'lanmadi: qolgan qismi qarzga yozilishi uchun mijozni tanlang")
  }

  await prisma.$transaction(async (tx) => {
    // Serializable isolation: parallel so'rovlar bir-birini ustiga yozolmaydi
    await tx.$executeRaw`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`

    // Mijoz shu tashkilotga tegishligini tekshirish
    if (customerId) {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, organizationId: orgId }
      })
      if (!customer) throw new ActionError("Mijoz topilmadi yoki ruxsat yo'q")
    }

    // Mahsulot va ombor shu tashkilotga tegishligini tekshirish
    const product = await tx.product.findFirst({
      where: { id: productId, organizationId: orgId }
    })
    if (!product) throw new ActionError("Mahsulot topilmadi yoki ruxsat yo'q")

    const warehouse = await tx.warehouse.findFirst({
      where: { id: warehouseId, organizationId: orgId }
    })
    if (!warehouse) throw new ActionError("Ombor topilmadi yoki ruxsat yo'q")

    // 1. Ombor qoldig'ini tekshirish va kamaytirish
    const stock = await tx.stockLevel.findUnique({
      where: {
        productId_warehouseId: { productId, warehouseId }
      }
    })

    if (!stock || stock.quantity < quantity) {
      throw new ActionError("Omborda yetarli mahsulot yo'q")
    }

    await tx.stockLevel.update({
      where: { id: stock.id },
      data: { quantity: { decrement: quantity } }
    })

    // 2. Sotuvni qayd etish (tannarx yuqorida olingan mahsulotdan snapshot qilinadi)
    await tx.sale.create({
      data: {
        totalAmount,
        paidAmount,
        paymentType,
        customerId: customerId || null,
        organizationId: orgId,
        items: {
          create: {
            productId,
            quantity,
            price: totalAmount / quantity,
            costPrice: product.costPrice
          }
        }
      }
    })

    // 3. Nasiya/Qarz hisob-kitobi
    const debtAmount = totalAmount - paidAmount
    if (debtAmount > 0 && customerId) {
       await tx.customer.update({
         where: { id: customerId },
         data: { debt: { increment: debtAmount } }
       })
    }

    // 4. Audit log (StockMovement)
    await tx.stockMovement.create({
      data: {
        type: 'OUT',
        quantity: -quantity,
        productId,
        fromWarehouseId: warehouseId,
        organizationId: orgId,
        note: `Sotuv: ${paymentType}. Jami: ${totalAmount.toLocaleString()} so'm. To'landi: ${paidAmount.toLocaleString()} so'm.`
      }
    })
  })

  // Ogohlantirishlarni tekshirish
  const { checkLowStock } = await import("@/lib/alerts")
  await checkLowStock(productId, orgId)

  revalidatePath("/inventory")
  revalidatePath("/customers")
  revalidatePath("/sales")
})

export async function getSales(limit = 200) {
  const orgId = await getOrgId()
  return await prisma.sale.findMany({
    where: { organizationId: orgId },
    include: { customer: true },
    orderBy: { createdAt: 'desc' },
    take: limit
  })
}
