'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { subDays, startOfDay, format } from "date-fns"

async function getOrgId() {
  const session = await auth()
  if (!session?.user) throw new Error("Avtorizatsiya kerak")
  return (session.user as any).organizationId
}

export async function getDashboardData() {
  const orgId = await getOrgId()

  // 1. Eng ko'p sotilgan (Chiqim qilingan) mahsulotlar
  const topProducts = await prisma.stockMovement.groupBy({
    by: ['productId'],
    where: {
      organizationId: orgId,
      type: 'OUT',
      quantity: { lt: 0 } // Chiqim salbiy qiymatda bo'lishi mumkin yoki musbat, biz sxemada quantityni parseFloat qilganmiz
    },
    _sum: {
      quantity: true
    },
    orderBy: {
      _sum: {
        quantity: 'asc' // Salbiy bo'lgani uchun 'asc' eng ko'p degani (masalan -100 < -10)
      }
    },
    take: 5
  })

  const productIds = topProducts.map(p => p.productId)
  const productDetails = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true }
  })
  const productMap = new Map(productDetails.map(p => [p.id, p.name]))

  const topProductDetails = topProducts.map(p => ({
    name: productMap.get(p.productId) || "Noma'lum",
    total: Math.abs(p._sum.quantity || 0)
  }))

  // 2. Aktiv omborlar soni
  const warehouseCount = await prisma.warehouse.count({
    where: { organizationId: orgId }
  })

  // 3. Qoldig'i kamaygan xomashyolar (Critical Stock < 10)
  const products = await prisma.product.findMany({
    where: {
      organizationId: orgId,
      isRawMaterial: true
    },
    include: {
      stockLevels: true
    }
  })

  const criticalStock = products.map(p => ({
    name: p.name,
    unit: p.unit,
    total: p.stockLevels.reduce((acc, sl) => acc + sl.quantity, 0),
    // minStockLevel — Prisma Decimal, taqqoslash uchun songa o'giramiz
    minLevel: Number(p.minStockLevel)
  })).filter(p => p.minLevel > 0 && p.total <= p.minLevel)

  // 3. Oxirgi 7 kunlik ishlab chiqarish grafigi
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), i)
    return startOfDay(date)
  }).reverse()

  const chartData = await Promise.all(
    last7Days.map(async (date) => {
      const nextDate = new Date(date)
      nextDate.setDate(date.getDate() + 1)

      const production = await prisma.stockMovement.aggregate({
        where: {
          organizationId: orgId,
          type: 'PRODUCTION',
          quantity: { gt: 0 },
          createdAt: {
            gte: date,
            lt: nextDate
          }
        },
        _sum: {
          quantity: true
        }
      })

      return {
        name: format(date, "dd-MMM"),
        miqdor: production._sum.quantity || 0
      }
    })
  )

  return {
    topProducts: topProductDetails,
    criticalStock,
    chartData,
    warehouseCount
  }
}
