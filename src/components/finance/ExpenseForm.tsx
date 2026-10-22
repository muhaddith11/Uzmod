'use client'

import { useState } from "react"
import { createExpense } from "@/lib/actions/expenses"
import { ActionForm } from "@/components/ui/action-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, NativeSelect, inputClass } from "@/components/ui/field"
import { useT } from "@/i18n/client"
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/domain/expenses"
import { cn } from "@/lib/utils"

/** Xarajat: turi tugma bilan tanlanadi; ish haqida — xodim */
export function ExpenseForm({ employees }: { employees: { id: string; name: string }[] }) {
  const t = useT()
  const F = t.finance
  const [category, setCategory] = useState<ExpenseCategory>("WORKSHOP")

  return (
    <ActionForm action={createExpense} successMessage={F.added} className="space-y-4">
      <input type="hidden" name="category" value={category} />
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={F.category}>
        {EXPENSE_CATEGORIES.map(c => (
          <button
            key={c} type="button" role="radio" aria-checked={category === c} onClick={() => setCategory(c)}
            className={cn(
              "rounded-xl border p-2.5 text-left transition-colors",
              category === c ? "border-rose-500 bg-rose-50" : "border-gray-200 bg-white hover:bg-gray-50"
            )}
          >
            <span className="block text-sm font-bold text-gray-900">{F.categoryLabels[c]}</span>
            <span className="block text-[11px] text-gray-500 leading-tight">{F.categoryHints[c]}</span>
          </button>
        ))}
      </div>

      {category === "SALARY" && employees.length > 0 && (
        <Field label={F.employee}>
          <NativeSelect name="employeeId" defaultValue="">
            <option value="">{t.common.none}</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </NativeSelect>
        </Field>
      )}

      <Field label={`${F.amount} (${t.common.currency})`}>
        <Input name="amount" type="number" step="1" min="0" required inputMode="numeric" placeholder="500000" className={inputClass} />
      </Field>
      <Field label={t.common.note}>
        <Input name="note" placeholder={t.common.notePlaceholder} className={inputClass} />
      </Field>
      <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 font-bold h-11 text-white">{t.common.add}</Button>
    </ActionForm>
  )
}
