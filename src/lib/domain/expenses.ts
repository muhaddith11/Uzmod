// Sex xarajatlari turlari. Bazada kalit saqlanadi; eski yozuvlarda erkin matn bo'lishi mumkin.
export const EXPENSE_CATEGORIES = ["WORKSHOP", "SALARY", "YARN", "OTHER"] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value)
}
