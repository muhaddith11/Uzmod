'use server'

import { prisma } from "@/lib/prisma"
import { getSessionUser, isManagement } from "@/lib/session"
import { addDays, lastTashkentDays, startOfTashkentDayFor } from "@/lib/tz"
import { formatShortDay } from "@/lib/format"
import { getLocale } from "@/i18n/server"

export async function getDashboardData() {
  const me = await getSessionUser()
  const orgId = me.organizationId
  const locale = await getLocale()
  const now = new Date()
  const todayStart = startOfTashkentDayFor(now)
  const days = lastTashkentDays(7, now)

  const [topItems, warehouseCount, rawMaterials, production, producedToday, salesToday, openRolls, machines, runningMachines, yarnToday] = await Promise.all([
    // Oxirgi 30 kunda eng ko'p sotilganlar (bekor qilinganlar hisobga olinmaydi)
    prisma.saleItem.groupBy({
      by: ['productId'],
      where: { sale: { organizationId: orgId, status: 'ACTIVE', createdAt: { gte: addDays(todayStart, -29) } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5
    }),
    prisma.warehouse.count({ where: { organizationId: orgId } }),
    prisma.product.findMany({
      where: { organizationId: orgId, isRawMaterial: true },
      include: { stockLevels: { select: { quantity: true } } }
    }),
    // 7 kunlik grafik — bitta so'rov, kunlarga JS'da bo'linadi
    prisma.stockMovement.findMany({
      where: { organizationId: orgId, type: 'PRODUCTION', quantity: { gt: 0 }, createdAt: { gte: days[0] } },
      select: { quantity: true, createdAt: true }
    }),
    prisma.stockMovement.aggregate({
      where: { organizationId: orgId, type: 'PRODUCTION', quantity: { gt: 0 }, createdAt: { gte: todayStart } },
      _sum: { quantity: true }
    }),
    isManagement(me.role)
      ? prisma.sale.aggregate({
          where: { organizationId: orgId, status: 'ACTIVE', createdAt: { gte: todayStart } },
          _sum: { totalAmount: true }
        })
      : Promise.resolve(null),
    prisma.roll.count({ where: { organizationId: orgId, status: { not: 'FINISHED' } } }),
    prisma.machine.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.machineRun.count({ where: { organizationId: orgId, status: 'OPEN' } }),
    prisma.stockMovement.aggregate({
      where: { organizationId: orgId, type: 'IN', createdAt: { gte: todayStart }, product: { yarnType: { not: null } } },
      _sum: { quantity: true },
    }),
  ])

  const names = await prisma.product.findMany({
    where: { id: { in: topItems.map(i => i.productId) }, organizationId: orgId },
    select: { id: true, name: true, unit: true }
  })
  const byId = new Map(names.map(p => [p.id, p]))

  const chartData = days.map(start => {
    const end = addDays(start, 1)
    const total = production
      .filter(m => m.createdAt >= start && m.createdAt < end)
      .reduce((acc, m) => acc + m.quantity, 0)
    return { name: formatShortDay(start, locale), value: total }
  })

  const criticalStock = rawMaterials
    .map(p => ({
      name: p.name,
      unit: p.unit,
      total: p.stockLevels.reduce((acc, sl) => acc + sl.quantity, 0),
      minLevel: Number(p.minStockLevel),
    }))
    .filter(p => p.minLevel > 0 && p.total <= p.minLevel)

  return {
    topProducts: topItems.map(i => ({
      name: byId.get(i.productId)?.name ?? "—",
      unit: byId.get(i.productId)?.unit ?? "",
      total: i._sum.quantity ?? 0,
    })),
    criticalStock,
    chartData,
    warehouseCount,
    producedToday: producedToday._sum.quantity ?? 0,
    salesToday: salesToday ? Number(salesToday._sum.totalAmount ?? 0) : null,
    openRolls,
    machines,
    runningMachines,
    yarnTodayKg: yarnToday._sum.quantity ?? 0,
  }
}
