'use server'

import { prisma } from "@/lib/prisma"
import { getOrgId, requireRole } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { action, ActionError } from "@/lib/action"

export async function getProducts() {
  const orgId = await getOrgId()
  return await prisma.product.findMany({
    where: { organizationId: orgId },
    include: { stockLevels: { include: { warehouse: true } } },
    orderBy: { name: 'asc' }
  })
}

export const createProduct = action(async function createProduct(formData: FormData) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const name = formData.get("name") as string
  const sku = formData.get("sku") as string
  const unit = formData.get("unit") as string
  const price = parseFloat(formData.get("price") as string || "0")
  const costPrice = parseFloat(formData.get("costPrice") as string || "0")
  const minStockLevel = parseFloat(formData.get("minStockLevel") as string || "0")
  const productionWage = parseFloat(formData.get("productionWage") as string || "0")
  const isRaw = formData.get("isRaw") === "on"
  // Rulon hisobi faqat xomashyo uchun ma'noga ega
  const isRollTracked = isRaw && formData.get("isRollTracked") === "on"

  if (!name?.trim()) throw new ActionError("Mahsulot nomi majburiy")
  if ([price, costPrice, productionWage, minStockLevel].some(n => isNaN(n))) {
    throw new ActionError("Narx va miqdor to'g'ri son bo'lishi kerak")
  }
  if (price < 0 || costPrice < 0 || productionWage < 0 || minStockLevel < 0) {
    throw new ActionError("Narx va miqdor manfiy bo'lishi mumkin emas")
  }

  await prisma.product.create({
    data: {
      name,
      sku,
      unit,
      price,
      costPrice,
      productionWage,
      minStockLevel,
      isRawMaterial: isRaw,
      isRollTracked,
      organizationId: orgId
    }
  })
  revalidatePath("/inventory")
})

export const deleteProduct = action(async function deleteProduct(id: string) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')

  const product = await prisma.product.findFirst({
    where: { id, organizationId: orgId }
  })
  if (!product) throw new ActionError("Mahsulot topilmadi yoki ruxsat yo'q")

  // StockMovement va SaleItem — Restrict, ya'ni tarixi bor mahsulotni Postgres
  // o'chirtirmaydi. Xom FK xatosi o'rniga tushunarli xabar beramiz.
  const [movements, saleItems] = await Promise.all([
    prisma.stockMovement.count({ where: { productId: id } }),
    prisma.saleItem.count({ where: { productId: id } }),
  ])
  if (movements > 0 || saleItems > 0) {
    throw new ActionError(
      "Bu mahsulotda harakat yoki sotuv tarixi bor, shuning uchun o'chirib bo'lmaydi. " +
      "Tarixni saqlab qolish uchun uni o'chirish o'rniga ishlatishni to'xtating."
    )
  }

  await prisma.product.delete({
    where: { id, organizationId: orgId }
  })
  revalidatePath("/inventory")
})
