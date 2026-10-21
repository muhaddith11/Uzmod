import { getExpenses, createExpense, deleteExpense } from "@/lib/actions/expenses"
import { ActionForm } from "@/components/ui/action-form"
import { Field, inputClass } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DeleteButton } from "@/components/ui/delete-button"
import { PageHeader, pageClass } from "@/components/PageHeader"
import { DateRangeFilter } from "@/components/DateRangeFilter"
import { ExportButton } from "@/components/ExportButton"
import { getLocale, getT } from "@/i18n/server"
import { formatDateTime, formatMoney } from "@/lib/format"
import { WalletIcon, PlusIcon, TrendingDownIcon, InfoIcon } from "lucide-react"

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const range = await searchParams
  const [t, locale, expenses] = await Promise.all([getT(), getLocale(), getExpenses(range)])
  const F = t.finance
  const total = expenses.reduce((acc, e) => acc + e.amount, 0)

  // Kategoriya bo'yicha yig'indi (eng kattasi birinchi)
  const byCategory = [...expenses.reduce((map, e) => map.set(e.category, (map.get(e.category) ?? 0) + e.amount), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1])

  return (
    <div className={pageClass}>
      <PageHeader icon={<WalletIcon className="text-rose-600" />} title={F.title} subtitle={F.subtitle}>
        <ExportButton kind="expenses" from={range.from} to={range.to} />
      </PageHeader>

      <DateRangeFilter basePath="/finance" from={range.from} to={range.to} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">{F.total}</p>
            <p className="text-2xl font-black text-rose-900 mt-1">{formatMoney(total, locale)}</p>
          </div>
          <TrendingDownIcon className="w-9 h-9 text-rose-200" />
        </div>
        {byCategory.slice(0, 3).map(([category, sum]) => (
          <div key={category} className="bg-white border border-gray-100 rounded-2xl p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{category}</p>
            <p className="text-xl font-black text-gray-900 mt-1">{formatMoney(sum, locale)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        <Card className="lg:col-span-1 shadow-sm border-none bg-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PlusIcon className="w-5 h-5 text-rose-600" />
              {F.newExpense}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ActionForm action={createExpense} successMessage={F.added} className="space-y-4">
              <Field label={`${F.amount} (${t.common.currency})`}>
                <Input name="amount" type="number" step="0.01" min="0" placeholder="50000" required className={inputClass} />
              </Field>
              <Field label={F.category}>
                <Input name="category" list="expense-categories" required className={inputClass} placeholder={F.categories[0]} />
                <datalist id="expense-categories">
                  {F.categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </Field>
              <Field label={t.common.note}>
                <Input name="note" placeholder={t.common.notePlaceholder} className={inputClass} />
              </Field>
              <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 font-bold h-11 text-white">{t.common.add}</Button>
            </ActionForm>
            <p className="text-xs text-gray-500 flex gap-1.5"><InfoIcon className="w-4 h-4 shrink-0 text-gray-400" />{F.purchaseHint}</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-sm border-none bg-white overflow-hidden min-w-0">
          <CardHeader className="border-b border-gray-50">
            <CardTitle className="text-lg text-gray-700">{F.list}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="px-4 font-bold">{t.common.date}</TableHead>
                  <TableHead className="px-4 font-bold">{F.category}</TableHead>
                  <TableHead className="px-4 font-bold">{F.amount}</TableHead>
                  <TableHead className="px-4 font-bold">{t.common.note}</TableHead>
                  <TableHead className="px-4 font-bold">{t.common.who}</TableHead>
                  <TableHead className="px-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="px-4 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(e.createdAt, locale)}</TableCell>
                    <TableCell className="px-4 font-bold text-gray-900">{e.category}</TableCell>
                    <TableCell className="px-4 font-black text-rose-700 whitespace-nowrap">{formatMoney(e.amount, locale)}</TableCell>
                    <TableCell className="px-4 text-gray-500 text-sm">{e.note ?? ""}</TableCell>
                    <TableCell className="px-4 text-gray-400 text-xs">{e.createdByName ?? ""}</TableCell>
                    <TableCell className="px-4 text-right">
                      <DeleteButton action={deleteExpense.bind(null, e.id)} confirmText={F.confirmDelete} />
                    </TableCell>
                  </TableRow>
                ))}
                {expenses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-gray-400 italic">{F.noExpenses}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
