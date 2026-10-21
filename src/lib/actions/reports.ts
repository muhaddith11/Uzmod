'use server'

import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/session"
import { parseDateRange, type DateRangeParams } from "@/lib/date-range"

export async function getFinancialSummary(range?: DateRangeParams) {
  // Moliyaviy ko'rsatkichlar — faqat rahbariyatga
  const { organizationId: orgId } = await requireRole('ADMIN')

  // Oqim qiymatlari (savdo, xarajat, ish haqi) tanlangan davr bo'yicha filtrlanadi.
  // Qarz va ombor bahosi esa "hozirgi" holat — davrga bog'liq emas.
  const createdAt = range ? parseDateRange(range) : undefined
  const dateWhere = createdAt ? { createdAt } : {}

  const [sales, expenses, customers, products, productionMovements, adjustments] = await Promise.all([
    // Jami sotuvlar va ularning tannarxi
    prisma.saleItem.findMany({
      where: { sale: { organizationId: orgId, ...dateWhere } },
      select: {
        price: true,
        costPrice: true,
        quantity: true
      }
    }),
    // Barcha bilvosita xarajatlar
    prisma.expense.findMany({
      where: { organizationId: orgId, ...dateWhere }
    }),
    // Umumiy qarzlar (hozirgi holat — davrga bog'liq emas)
    prisma.customer.aggregate({
      where: { organizationId: orgId },
      _sum: { debt: true }
    }),
    // Ombor qiymati (hozirgi holat — davrga bog'liq emas)
    prisma.stockLevel.findMany({
      where: { product: { organizationId: orgId } },
      include: { product: true }
    }),
    // Ishbay haq: ishlab chiqarilgan har bir dona uchun productionWage
    prisma.stockMovement.findMany({
      where: { organizationId: orgId, type: 'PRODUCTION', quantity: { gt: 0 }, ...dateWhere },
      select: { quantity: true, product: { select: { productionWage: true } } }
    }),
    // Bonus/jarima (amount ishorali saqlanadi: BONUS musbat, PENALTY manfiy)
    prisma.staffAdjustment.aggregate({
      where: { organizationId: orgId, ...dateWhere },
      _sum: { amount: true }
    })
  ])

  // 1. Daromad va Tannarxni hisoblash
  let totalRevenue = 0
  let totalCOGS = 0
  sales.forEach(item => {
    totalRevenue += Number(item.price) * item.quantity
    totalCOGS += Number(item.costPrice) * item.quantity
  })

  // 2. Operatsion xarajatlar
  const totalExpenses = expenses.reduce((acc, ex) => acc + Number(ex.amount), 0)

  // 3. Xodimlar xarajati: ishbay haq + bonus - jarima
  const totalWages = productionMovements.reduce(
    (acc, m) => acc + m.quantity * Number(m.product.productionWage || 0),
    0
  )
  const totalAdjustments = Number(adjustments._sum.amount || 0)
  const totalStaffCost = totalWages + totalAdjustments

  // 4. Foyda — xodimlar xarajati ham hisobga olinadi
  const grossProfit = totalRevenue - totalCOGS
  const netProfit = grossProfit - totalExpenses - totalStaffCost

  // 5. Ombor qiymati
  const inventoryValue = products.reduce((acc, sl) => acc + (Number(sl.product.costPrice) * sl.quantity), 0)

  // 6. Xarajatlar kategoriyasi bo'yicha (Pie chart uchun).
  // Xodimlar xarajati alohida kategoriya sifatida qo'shiladi, aks holda
  // diagramma jami xarajatni to'liq ko'rsatmaydi.
  const expenseCategories: Record<string, number> = {}
  expenses.forEach(ex => {
    expenseCategories[ex.category] = (expenseCategories[ex.category] || 0) + Number(ex.amount)
  })
  if (totalStaffCost !== 0) {
    expenseCategories["Ish haqi"] = (expenseCategories["Ish haqi"] || 0) + totalStaffCost
  }

  return {
    totalRevenue,
    totalCOGS,
    totalExpenses,
    totalWages,
    totalAdjustments,
    totalStaffCost,
    grossProfit,
    netProfit,
    inventoryValue,
    totalDebt: Number(customers._sum.debt || 0),
    expenseChart: Object.entries(expenseCategories).map(([name, value]) => ({ name, value })),
    salesCount: sales.length
  }
}
