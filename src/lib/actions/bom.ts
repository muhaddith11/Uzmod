'use server'

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/session"
import { action, ActionError } from "@/lib/action"
import { fields, parseForm } from "@/lib/validation"
import { getT } from "@/i18n/server"

export const addBOMItem = action(async function addBOMItem(formData: FormData) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const f = fields(t)
  const input = parseForm(z.object({
    productId: f.id(t.common.product),
    materialId: f.id(t.inventory.bomMaterial),
    quantityNeeded: f.positive(t.inventory.bomQty),
  }), formData)

  const product = await prisma.product.findFirst({
    where: { id: input.productId, organizationId: orgId }
  })
  if (!product) throw new ActionError(t.errors.productNotFound)
  if (product.isRawMaterial) throw new ActionError(t.inventory.bomOnlyFinished)

  const material = await prisma.product.findFirst({
    where: { id: input.materialId, organizationId: orgId, isRawMaterial: true }
  })
  if (!material) throw new ActionError(t.errors.materialNotFound)

  try {
    await prisma.bom.create({
      data: { productId: product.id, materialId: material.id, quantityNeeded: input.quantityNeeded }
    })
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') throw new ActionError(t.inventory.bomDuplicate)
    throw error
  }
  revalidatePath(`/inventory/${product.id}`)
  revalidatePath("/production")
})

export const deleteBOMItem = action(async function deleteBOMItem(id: string) {
  const { organizationId: orgId } = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()

  const bom = await prisma.bom.findFirst({
    where: { id, product: { organizationId: orgId } },
    select: { id: true, productId: true }
  })
  if (!bom) throw new ActionError(t.errors.recordNotFound)

  await prisma.bom.delete({ where: { id: bom.id } })
  revalidatePath(`/inventory/${bom.productId}`)
  revalidatePath("/production")
})
