'use server'

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getOrgId, requireRole } from "@/lib/session"
import { action, ActionError } from "@/lib/action"
import { fields, parseForm } from "@/lib/validation"
import { getT } from "@/i18n/server"

export async function getWarehouses() {
  const orgId = await getOrgId()
  return await prisma.warehouse.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, address: true },
    orderBy: { name: 'asc' }
  })
}

export const createWarehouse = action(async function createWarehouse(formData: FormData) {
  const { organizationId: orgId } = await requireRole('ADMIN')
  const t = await getT()
  const f = fields(t)
  const input = parseForm(z.object({
    name: f.text(t.warehouses.name, 100),
    address: f.optionalText(t.warehouses.address, 300),
  }), formData)

  await prisma.warehouse.create({
    data: { name: input.name, address: input.address ?? null, organizationId: orgId }
  })
  revalidatePath("/warehouses")
})

export const deleteWarehouse = action(async function deleteWarehouse(id: string) {
  const { organizationId: orgId } = await requireRole('ADMIN')
  const t = await getT()

  const warehouse = await prisma.warehouse.findFirst({ where: { id, organizationId: orgId } })
  if (!warehouse) throw new ActionError(t.errors.warehouseNotFound)

  const stockWithGoods = await prisma.stockLevel.findFirst({
    where: { warehouseId: id, quantity: { gt: 0 } }
  })
  if (stockWithGoods) throw new ActionError(t.warehouses.hasStock)

  // Rulonlar Roll.warehouse orqali cascade o'chadi — vazni qolganlarini yo'qotib
  // qo'ymaslik uchun alohida tekshiramiz.
  const rollsLeft = await prisma.roll.findFirst({
    where: { warehouseId: id, status: { not: 'FINISHED' } }
  })
  if (rollsLeft) throw new ActionError(t.warehouses.hasRolls)

  // Harakatlar tarixi omborga bog'langan — tarixli omborni o'chirib bo'lmaydi
  const movements = await prisma.stockMovement.count({
    where: { OR: [{ fromWarehouseId: id }, { toWarehouseId: id }] }
  })
  if (movements > 0) throw new ActionError(t.warehouses.hasHistory)

  await prisma.warehouse.delete({ where: { id: warehouse.id } })
  revalidatePath("/warehouses")
})
