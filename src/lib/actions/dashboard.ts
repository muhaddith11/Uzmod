'use server'

import { prisma } from "@/lib/prisma"
import { getSessionUser, isManagement } from "@/lib/session"
import { roundQty } from "@/lib/domain/costing"
import { socksFromKg } from "@/lib/domain/machines"
import { settleDueLoads, wasteInStock } from "@/lib/workshop"
import { addDays, lastTashkentDays, startOfTashkentDayFor } from "@/lib/tz"
import { formatShortDay } from "@/lib/format"
import { getLocale } from "@/i18n/server"

/** Bosh sahifa: ombor (kg), stanoklar, bugungi ishlab chiqarish va sotuv, 7 kunlik grafik */
export async function getDashboardData() {
  const me = await getSessionUser()
  const orgId = me.organizationId
  const locale = await getLocale()
  const now = new Date()
  const todayStart = startOfTashkentDayFor(now)
  const days = lastTashkentDays(7, now)
  const management = isManagement(me.role)
  await settleDueLoads(orgId, now)

  const [yarn, batches, machines, knitting, produced, yarnToday, salesToday, wasteKg] = await Promise.all([
    prisma.stockLevel.aggregate({
      where: { product: { organizationId: orgId, isRawMaterial: true, yarnType: { not: null } } },
      _sum: { quantity: true },
    }),
    prisma.batch.aggregate({ where: { organizationId: orgId }, _sum: { finishedKg: true, defectKg: true } }),
    prisma.machine.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.machineLoad.findMany({
      where: { organizationId: orgId, status: 'KNITTING' },
      select: { machineId: true, kg: true },
    }),
    // 7 kunlik grafik — omborga o'tgan paypoq (kg), kunlarga JS'da bo'linadi
    prisma.batchMovement.findMany({
      where: { organizationId: orgId, type: 'PRODUCED', createdAt: { gte: days[0] } },
      select: { kg: true, createdAt: true, batch: { select: { gramsPerSock: true } } },
    }),
    prisma.stockMovement.aggregate({
      where: { organizationId: orgId, type: 'IN', createdAt: { gte: todayStart }, product: { yarnType: { not: null } } },
      _sum: { quantity: true },
    }),
    management
      ? prisma.stockSale.aggregate({ where: { organizationId: orgId, createdAt: { gte: todayStart } }, _sum: { totalAmount: true } })
      : Promise.resolve(null),
    wasteInStock(prisma, orgId),
  ])

  const chartData = days.map(start => {
    const end = addDays(start, 1)
    const total = produced
      .filter(m => m.createdAt >= start && m.createdAt < end)
      .reduce((acc, m) => acc + m.kg, 0)
    return { name: formatShortDay(start, locale), value: roundQty(total) }
  })
  const today = produced.filter(m => m.createdAt >= todayStart)

  return {
    yarnKg: roundQty(yarn._sum.quantity ?? 0),
    finishedKg: roundQty(batches._sum.finishedKg ?? 0),
    defectKg: roundQty(batches._sum.defectKg ?? 0),
    wasteKg,
    machines,
    runningMachines: new Set(knitting.map(l => l.machineId)).size,
    knittingKg: roundQty(knitting.reduce((acc, l) => acc + l.kg, 0)),
    producedTodayKg: roundQty(today.reduce((acc, m) => acc + m.kg, 0)),
    producedTodaySocks: today.reduce((acc, m) => acc + socksFromKg(m.kg, m.batch.gramsPerSock), 0),
    yarnTodayKg: roundQty(yarnToday._sum.quantity ?? 0),
    salesToday: salesToday ? Number(salesToday._sum.totalAmount ?? 0) : null,
    chartData,
  }
}
