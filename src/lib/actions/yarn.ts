'use server'

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/session"
import { action, ActionError } from "@/lib/action"
import { fields, parseForm, parseInput } from "@/lib/validation"
import { serializable } from "@/lib/db"
import { addStock, applyIncomingCost, totalStock } from "@/lib/inventory"
import { assertOrgWarehouse } from "@/lib/guards"
import { roundQty } from "@/lib/domain/costing"
import { yarnName } from "@/lib/domain/machines"
import { startOfTashkentDayFor } from "@/lib/tz"
import { getT } from "@/i18n/server"

/**
 * Ip qoldiqlari: tur + rang bo'yicha. Har biri uchun bugun kelgani va hozir
 * ochiq stanok ishlarida turgan ip ham ko'rsatiladi.
 */
export async function getYarnStock() {
  const { organizationId } = await requireRole('ADMIN', 'MANAGER')
  const todayStart = startOfTashkentDayFor(new Date())
  const [items, today, openRuns] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId, isRawMaterial: true, yarnType: { not: null } },
      include: { stockLevels: { select: { quantity: true } } },
      orderBy: [{ yarnType: 'asc' }, { color: 'asc' }],
    }),
    prisma.stockMovement.groupBy({
      by: ['productId'],
      where: { organizationId, type: 'IN', createdAt: { gte: todayStart } },
      _sum: { quantity: true },
    }),
    prisma.machineRun.groupBy({
      by: ['yarnId'],
      where: { organizationId, status: 'OPEN' },
      _sum: { issuedKg: true },
    }),
  ])
  const todayById = new Map(today.map(t => [t.productId, t._sum.quantity ?? 0]))
  const inMachinesById = new Map(openRuns.map(r => [r.yarnId, r._sum.issuedKg ?? 0]))

  return items.map(p => ({
    id: p.id,
    name: p.name,
    yarnType: p.yarnType ?? "",
    color: p.color ?? "",
    stockKg: roundQty(p.stockLevels.reduce((acc, sl) => acc + sl.quantity, 0)),
    todayKg: roundQty(todayById.get(p.id) ?? 0),
    inMachinesKg: roundQty(inMachinesById.get(p.id) ?? 0),
    costPerKg: Number(p.costPrice),
  }))
}

/**
 * Ip qabul qilish: bir nechta qator (tur, rang, kg, narx). Tur+rang bo'yicha ip
 * topiladi yoki yaratiladi. Narx berilsa — o'rtacha tannarx yangilanadi.
 */
export const receiveYarn = action(async function receiveYarn(formData: FormData) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const f = fields(t)
  const Y = t.yarn

  const head = parseForm(z.object({
    warehouseId: f.optionalId(),
    note: f.optionalText(t.common.note),
    lines: z.string(),
  }), formData)

  let raw: unknown
  try {
    raw = JSON.parse(head.lines)
  } catch {
    throw new ActionError(t.errors.invalidJson)
  }
  const lines = parseInput(
    z.array(z.object({
      type: f.text(Y.type, 60),
      color: f.text(Y.color, 60),
      kg: f.positive(Y.kg),
      price: f.optionalNonNegative(Y.pricePerKg),
    })).min(1, Y.noLines).max(50, t.sales.tooManyItems),
    raw,
  )

  const warehouseId = head.warehouseId ?? (await prisma.warehouse.findFirst({
    where: { organizationId: me.organizationId },
    orderBy: { name: 'asc' },
    select: { id: true },
  }))?.id
  if (!warehouseId) throw new ActionError(t.errors.warehouseNotFound)
  await assertOrgWarehouse(me.organizationId, warehouseId)

  await serializable(async (tx) => {
    for (const line of lines) {
      const yarnType = line.type.trim()
      const color = line.color.trim()
      // Katta-kichik harf farqi yangi ip yaratmasin
      let product = await tx.product.findFirst({
        where: {
          organizationId: me.organizationId,
          isRawMaterial: true,
          yarnType: { equals: yarnType, mode: 'insensitive' },
          color: { equals: color, mode: 'insensitive' },
        },
      })
      if (!product) {
        product = await tx.product.create({
          data: {
            name: yarnName(yarnType, color),
            unit: "kg",
            isRawMaterial: true,
            yarnType,
            color,
            costPrice: line.price ?? 0,
            organizationId: me.organizationId,
          },
        })
      }

      const kg = roundQty(line.kg)
      const qtyBefore = await totalStock(tx, product.id)
      await addStock(tx, product.id, warehouseId, kg)
      if (line.price !== undefined) {
        await applyIncomingCost(tx, product, qtyBefore, kg, line.price)
      }
      await tx.stockMovement.create({
        data: {
          type: 'IN',
          quantity: kg,
          productId: product.id,
          toWarehouseId: warehouseId,
          unitCost: line.price ?? product.costPrice,
          creatorId: me.id,
          organizationId: me.organizationId,
          note: head.note ?? Y.receiveNote,
        },
      })
    }
  })

  revalidatePath("/yarn")
  revalidatePath("/machines")
  revalidatePath("/")
})
