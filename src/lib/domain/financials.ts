import { roundMoney } from "./costing"

export type FinancialInput = {
  // Faqat faol (bekor qilinmagan) sotuv qatorlari; narxlar bir birlik uchun
  saleItems: { price: number; costPrice: number; quantity: number }[]
  salesPaid: number
  debtPayments: number
  expenses: { category: string; amount: number }[]
  adjustmentsTotal: number
  production: { quantity: number; unitWage: number }[]
  purchases: { quantity: number; unitCost: number }[]
  supplierPayments: number
  inventory: { quantity: number; costPrice: number }[]
  customerDebt: number
  supplierDebt: number
  bonusCategoryLabel: string
}

/**
 * Moliyaviy ko'rsatkichlar. Ishbay haq mahsulot tannarxiga kiradi va mahsulot
 * sotilganda COGS orqali foydadan ayiriladi — alohida yana ayirilmaydi (avval
 * ikki marta ayirilardi). Hisoblangan ishbay haq faqat ma'lumot uchun ko'rsatiladi.
 */
export function computeFinancials(input: FinancialInput) {
  let revenue = 0
  let cogs = 0
  for (const item of input.saleItems) {
    revenue += item.price * item.quantity
    cogs += item.costPrice * item.quantity
  }

  const totalExpenses = input.expenses.reduce((acc, e) => acc + e.amount, 0)
  const grossProfit = revenue - cogs
  const netProfit = grossProfit - totalExpenses - input.adjustmentsTotal

  const accruedWages = input.production.reduce((acc, p) => acc + p.quantity * p.unitWage, 0)
  const purchases = input.purchases.reduce((acc, p) => acc + p.quantity * p.unitCost, 0)
  const inventoryValue = input.inventory.reduce((acc, i) => acc + Math.max(i.quantity, 0) * i.costPrice, 0)

  const byCategory = new Map<string, number>()
  for (const e of input.expenses) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount)
  }
  if (input.adjustmentsTotal > 0) {
    byCategory.set(input.bonusCategoryLabel, (byCategory.get(input.bonusCategoryLabel) ?? 0) + input.adjustmentsTotal)
  }

  return {
    revenue: roundMoney(revenue),
    cogs: roundMoney(cogs),
    grossProfit: roundMoney(grossProfit),
    totalExpenses: roundMoney(totalExpenses),
    adjustmentsTotal: roundMoney(input.adjustmentsTotal),
    netProfit: roundMoney(netProfit),
    accruedWages: roundMoney(accruedWages),
    cashIn: roundMoney(input.salesPaid + input.debtPayments),
    purchases: roundMoney(purchases),
    supplierPayments: roundMoney(input.supplierPayments),
    inventoryValue: roundMoney(inventoryValue),
    customerDebt: roundMoney(input.customerDebt),
    supplierDebt: roundMoney(input.supplierDebt),
    salesLines: input.saleItems.length,
    expenseChart: [...byCategory.entries()].map(([name, value]) => ({ name, value: roundMoney(value) })),
  }
}

export type FinancialSummary = ReturnType<typeof computeFinancials>
