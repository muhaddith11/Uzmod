'use server'

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getSessionUser, isManagement, requireRole } from "@/lib/session"
import { action, ActionError } from "@/lib/action"
import { fields, parseForm } from "@/lib/validation"
import { getT } from "@/i18n/server"

export type ProductRow = {
  id: string
  name: string
  sku: string | null
  unit: string
  isRawMaterial: boolean
  isRollTracked: boolean
  // Ishchiga narxlar ko'rsatilmaydi — null keladi
  price: number | null
  costPrice: number | null
  productionWage: number | null
  minStockLevel: number
  totalQty: number
  stockLevels: { id: string; warehouseId: string; warehouseName: string; quantity: number }[]
}

/**
 * Katalog. Decimal qiymatlar oddiy songa o'giriladi — client komponentlarga ham
 * uzatsa bo'ladi (Prisma Decimal obyekti React orqali o'tmaydi).
 */
export async function getProducts(): Promise<ProductRow[]> {
  const me = await getSessionUser()
  const showPrices = isManagement(me.role)

  const products = await prisma.product.findMany({
    where: { organizationId: me.organizationId },
    include: { stockLevels: { include: { warehouse: { select: { name: true } } } } },
    orderBy: { name: 'asc' }
  })

  return products.map(p => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    unit: p.unit,
    isRawMaterial: p.isRawMaterial,
    isRollTracked: p.isRollTracked,
    price: showPrices ? Number(p.price) : null,
    costPrice: showPrices ? Number(p.costPrice) : null,
    productionWage: showPrices ? Number(p.productionWage) : null,
    minStockLevel: Number(p.minStockLevel),
    totalQty: p.stockLevels.reduce((acc, sl) => acc + sl.quantity, 0),
    stockLevels: p.stockLevels.map(sl => ({
      id: sl.id,
      warehouseId: sl.warehouseId,
      warehouseName: sl.warehouse.name,
      quantity: sl.quantity,
    })),
  }))
}

async function productSchema() {
  const t = await getT()
  const f = fields(t)
  const L = t.inventory
  return z.object({
    name: f.text(L.name, 150),
    sku: f.optionalText(L.sku, 60),
    unit: f.text(L.unit, 20),
    price: f.nonNegative(L.salePrice),
    productionWage: f.optionalNonNegative(L.wage),
    minStockLevel: f.optionalNonNegative(L.minStock),
  })
}

export const createProduct = action(async function createProduct(formData: FormData) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const f = fields(t)
  const input = parseForm((await productSchema()).extend({
    costPrice: f.optionalNonNegative(t.inventory.initialCost),
    isRaw: f.checkbox(),
    isRollTracked: f.checkbox(),
  }), formData)

  await prisma.product.create({
    data: {
      name: input.name,
      sku: input.sku ?? null,
      unit: input.unit,
      price: input.price,
      costPrice: input.costPrice ?? 0,
      productionWage: input.isRaw ? 0 : (input.productionWage ?? 0),
      minStockLevel: input.minStockLevel ?? 0,
      isRawMaterial: input.isRaw,
      // Rulon hisobi faqat xomashyo uchun ma'noga ega
      isRollTracked: input.isRaw && input.isRollTracked,
      organizationId: orgId
    }
  })
  revalidatePath("/inventory")
})

/**
 * Nom, birlik, sotuv narxi, ishbay haq va limitni tahrirlash. Tannarx qo'lda
 * o'zgartirilmaydi — u kirim va ishlab chiqarishdan hisoblanadi.
 */
export const updateProduct = action(async function updateProduct(formData: FormData) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const f = fields(t)
  const input = parseForm((await productSchema()).extend({ id: f.id(t.common.product) }), formData)

  const product = await prisma.product.findFirst({ where: { id: input.id, organizationId: orgId } })
  if (!product) throw new ActionError(t.errors.productNotFound)

  await prisma.product.update({
    where: { id: product.id },
    data: {
      name: input.name,
      sku: input.sku ?? null,
      unit: input.unit,
      price: input.price,
      productionWage: product.isRawMaterial ? 0 : (input.productionWage ?? 0),
      minStockLevel: input.minStockLevel ?? 0,
    }
  })
  revalidatePath("/inventory")
  revalidatePath(`/inventory/${product.id}`)
})

export const deleteProduct = action(async function deleteProduct(id: string) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()

  const product = await prisma.product.findFirst({
    where: { id, organizationId: orgId }
  })
  if (!product) throw new ActionError(t.errors.productNotFound)

  // StockMovement va SaleItem — Restrict, ya'ni tarixi bor mahsulotni Postgres
  // o'chirtirmaydi. Xom FK xatosi o'rniga tushunarli xabar beramiz.
  const [movements, saleItems] = await Promise.all([
    prisma.stockMovement.count({ where: { productId: id } }),
    prisma.saleItem.count({ where: { productId: id } }),
  ])
  if (movements > 0 || saleItems > 0) throw new ActionError(t.inventory.hasHistory)

  await prisma.product.delete({ where: { id: product.id } })
  revalidatePath("/inventory")
})
