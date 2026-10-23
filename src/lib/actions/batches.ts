'use server'

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/session"
import { action, ActionError } from "@/lib/action"
import { fields, parseForm } from "@/lib/validation"
import { serializable } from "@/lib/db"
import { QTY_EPSILON, roundQty } from "@/lib/domain/costing"
import { batchLabel, socksFromKg } from "@/lib/domain/machines"
import { settleDueLoads, wasteInStock } from "@/lib/workshop"
import { formatNumber } from "@/lib/format"
import { addDays, tashkentDateKey } from "@/lib/tz"
import { getLocale, getT } from "@/i18n/server"

// Sotilib tugagan partiya ham shuncha kun ro'yxatda turadi — undan chiqqan otxot ko'rinsin
const RECENT_BATCH_DAYS = 14

/**
 * Bitta ombor ko'rinishi: ip, tayyor paypoq, brak va otxot (kg). Tayyor, brak va
 * chiqqan otxot — partiyalar bo'yicha (sana + ip + gramm). Hozir stanoklarda tikilayotgani ham.
 */
export async function getStockOverview() {
  const { organizationId } = await requireRole('ADMIN', 'MANAGER')
  await settleDueLoads(organizationId)
  const recentFrom = tashkentDateKey(addDays(new Date(), -RECENT_BATCH_DAYS))
  const [yarnLevels, batches, knitting, wasteKg] = await Promise.all([
    prisma.stockLevel.aggregate({
      where: { product: { organizationId, isRawMaterial: true, yarnType: { not: null } } },
      _sum: { quantity: true },
    }),
    prisma.batch.findMany({
      where: {
        organizationId,
        OR: [{ finishedKg: { gt: QTY_EPSILON } }, { defectKg: { gt: QTY_EPSILON } }, { date: { gte: recentFrom } }],
      },
      include: { yarn: { select: { name: true, color: true } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.machineLoad.findMany({
      where: { organizationId, status: 'KNITTING' },
      select: { kg: true, gramsPerSock: true, readyAt: true },
    }),
    wasteInStock(prisma, organizationId),
  ])

  const rows = batches.map(b => ({
    id: b.id,
    label: batchLabel(b.date, b.yarn.name, b.gramsPerSock),
    date: b.date,
    yarnName: b.yarn.name,
    yarnColor: b.yarn.color,
    gramsPerSock: b.gramsPerSock,
    finishedKg: roundQty(b.finishedKg),
    finishedSocks: socksFromKg(b.finishedKg, b.gramsPerSock),
    defectKg: roundQty(b.defectKg),
    wasteKg: roundQty(b.wasteKg),
    producedKg: roundQty(b.producedKg),
  }))

  return {
    yarnKg: roundQty(yarnLevels._sum.quantity ?? 0),
    finishedKg: roundQty(rows.reduce((acc, r) => acc + r.finishedKg, 0)),
    finishedSocks: rows.reduce((acc, r) => acc + r.finishedSocks, 0),
    defectKg: roundQty(rows.reduce((acc, r) => acc + r.defectKg, 0)),
    wasteKg,
    knitting: {
      kg: roundQty(knitting.reduce((acc, l) => acc + l.kg, 0)),
      socks: knitting.reduce((acc, l) => acc + socksFromKg(l.kg, l.gramsPerSock), 0),
      machines: knitting.length,
      nextReadyAt: knitting.reduce<Date | null>((min, l) => (!min || l.readyAt < min ? l.readyAt : min), null),
    },
    batches: rows,
  }
}

/** Qadoqlashda topilgan brak: tayyor partiyadan brakka o'tkaziladi (kg) */
export const markDefect = action(async function markDefect(formData: FormData) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const locale = await getLocale()
  const f = fields(t)
  const S = t.stock
  const input = parseForm(z.object({
    batchId: f.id(S.batch),
    kg: f.positive(S.defectKg),
    note: f.optionalText(t.common.note),
  }), formData)
  const kg = roundQty(input.kg)

  await serializable(async (tx) => {
    const batch = await tx.batch.findFirst({ where: { id: input.batchId, organizationId: me.organizationId } })
    if (!batch) throw new ActionError(t.errors.recordNotFound)
    if (kg > batch.finishedKg + QTY_EPSILON) {
      throw new ActionError(S.notEnoughFinished(`${formatNumber(batch.finishedKg, locale)} kg`))
    }
    const finishedKg = roundQty(batch.finishedKg - kg)
    await tx.batch.update({
      where: { id: batch.id },
      data: { finishedKg: Math.abs(finishedKg) < QTY_EPSILON ? 0 : finishedKg, defectKg: { increment: kg } },
    })
    await tx.batchMovement.create({
      data: {
        batchId: batch.id, type: 'DEFECT', kg, note: input.note ?? null,
        createdById: me.id, organizationId: me.organizationId,
      },
    })
  })
  revalidatePath("/stock")
  revalidatePath("/sales")
  revalidatePath("/")
})

/**
 * Partiyadan chiqqan otxot (chiqindi ip): tayyor partiya og'irligidan ayirilib otxotga
 * o'tadi — ip = tayyor + brak + otxot bo'lib qoladi. Ombordagi otxotga qo'shiladi.
 */
export const recordWaste = action(async function recordWaste(formData: FormData) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const locale = await getLocale()
  const f = fields(t)
  const S = t.stock
  const input = parseForm(z.object({
    batchId: f.id(S.batch),
    kg: f.positive(S.wasteKg),
    note: f.optionalText(t.common.note),
  }), formData)
  const kg = roundQty(input.kg)

  await serializable(async (tx) => {
    const batch = await tx.batch.findFirst({ where: { id: input.batchId, organizationId: me.organizationId } })
    if (!batch) throw new ActionError(t.errors.recordNotFound)
    if (kg > batch.finishedKg + QTY_EPSILON) {
      throw new ActionError(S.notEnoughFinished(`${formatNumber(batch.finishedKg, locale)} kg`))
    }
    const finishedKg = roundQty(batch.finishedKg - kg)
    await tx.batch.update({
      where: { id: batch.id },
      data: { finishedKg: Math.abs(finishedKg) < QTY_EPSILON ? 0 : finishedKg, wasteKg: { increment: kg } },
    })
    await tx.batchMovement.create({
      data: {
        batchId: batch.id, type: 'WASTE', kg, note: input.note ?? null,
        createdById: me.id, organizationId: me.organizationId,
      },
    })
  })
  revalidatePath("/stock")
  revalidatePath("/sales")
  revalidatePath("/")
})
