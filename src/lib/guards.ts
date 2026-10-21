import { prisma } from "@/lib/prisma"
import { ActionError } from "@/lib/action"
import { getT } from "@/i18n/server"

// Client yuborgan ID'lar shu tashkilotga tegishli ekanini tekshiruvchi yordamchilar.
// Server action fayllaridan tashqarida — aks holda ular ham ochiq endpoint bo'lib qolardi.

export async function findOrgProduct(orgId: string, productId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, organizationId: orgId } })
  if (!product) throw new ActionError((await getT()).errors.productNotFound)
  return product
}

export async function assertOrgWarehouse(orgId: string, warehouseId: string) {
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: warehouseId, organizationId: orgId },
    select: { id: true, name: true },
  })
  if (!warehouse) throw new ActionError((await getT()).errors.warehouseNotFound)
  return warehouse
}

export async function assertOrgSupplier(orgId: string, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, organizationId: orgId },
    select: { id: true },
  })
  if (!supplier) throw new ActionError((await getT()).errors.supplierNotFound)
  return supplier
}

export async function assertOrgCustomer(orgId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: orgId },
    select: { id: true },
  })
  if (!customer) throw new ActionError((await getT()).errors.customerNotFound)
  return customer
}
