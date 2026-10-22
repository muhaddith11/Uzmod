import { requireModule } from "@/lib/modules"
import { getFinanceSummary } from "@/lib/actions/finance"
import { deleteExpense } from "@/lib/actions/expenses"
import { repayDebt } from "@/lib/actions/customers"
import { getStaff } from "@/lib/actions/workers"
import { resolveRange } from "@/lib/attendance"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DeleteButton } from "@/components/ui/delete-button"
import { FormDialog } from "@/components/ui/form-dialog"
import { Input } from "@/components/ui/input"
import { Field, inputClass } from "@/components/ui/field"
import { ExpenseForm } from "@/components/finance/ExpenseForm"
import { PageHeader, pageClass } from "@/components/PageHeader"
import { DateRangeFilter } from "@/components/DateRangeFilter"
import { ExportButton } from "@/components/ExportButton"
import { getLocale, getT } from "@/i18n/server"
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format"
import { WalletIcon, PlusIcon, HandCoinsIcon } from "lucide-react"

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  await requireModule("finance")
  const range = resolveRange(await searchParams)
  const [t, locale, data, staff] = await Promise.all([getT(), getLocale(), getFinanceSummary(range), getStaff()])
  const F = t.finance
  const C = t.customers
  const money = (n: number) => formatMoney(n, locale)
  const employees = staff.filter(s => s.isActive).map(s => ({ id: s.id, name: s.name ?? s.email }))

  return (
    <div className={pageClass}>
      <PageHeader icon={<WalletIcon className="text-rose-600" />} title={F.title} subtitle={F.subtitle}>
        <ExportButton kind="expenses" from={range.from} to={range.to} />
      </PageHeader>

      <DateRangeFilter basePath="/finance" from={range.from} to={range.to} allowAllTime={false} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label={F.salesTotal} value={money(data.salesTotal)} sub={F.salesCount(data.salesCount, formatNumber(data.soldKg, locale))} />
        <Stat label={F.cashIn} value={money(data.cashIn)} sub={data.repaid > 0 ? F.cashInHint(money(data.repaid)) : undefined} tone="green" />
        <Stat label={F.expensesTotal} value={money(data.expensesTotal)} tone="rose" />
        <Stat label={F.balance} value={money(data.balance)} sub={F.balanceHint} tone={data.balance < 0 ? "rose" : "indigo"} />
        <Stat label={F.totalDebt} value={money(data.totalDebt)} tone="amber" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {data.byCategory.map(c => (
          <div key={c.category} className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{F.categoryLabels[c.category] ?? c.category}</p>
            <p className="text-lg font-black text-gray-900">{money(c.amount)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        <Card className="lg:col-span-1 shadow-sm border-none bg-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><PlusIcon className="w-5 h-5 text-rose-600" />{F.newExpense}</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseForm employees={employees} />
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
                  <TableHead className="px-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.expenses.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="px-4 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(e.createdAt, locale)}</TableCell>
                    <TableCell className="px-4 font-bold text-gray-900">
                      {F.categoryLabels[e.category] ?? e.category}
                      {e.employeeName && <span className="font-normal text-gray-500"> · {e.employeeName}</span>}
                    </TableCell>
                    <TableCell className="px-4 font-black text-rose-700 whitespace-nowrap">{money(e.amount)}</TableCell>
                    <TableCell className="px-4 text-gray-500 text-sm">{e.note ?? ""}</TableCell>
                    <TableCell className="px-4 text-right">
                      <DeleteButton action={deleteExpense.bind(null, e.id)} confirmText={F.confirmDelete} />
                    </TableCell>
                  </TableRow>
                ))}
                {data.expenses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-28 text-center text-gray-400 italic">{F.noExpenses}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Card className="shadow-sm border-none bg-white overflow-hidden">
          <CardHeader className="border-b border-gray-50">
            <CardTitle className="text-lg flex items-center gap-2"><HandCoinsIcon className="w-5 h-5 text-amber-600" />{F.debtorsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {data.debtors.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="px-4">
                      <span className="font-bold text-gray-900">{c.name}</span>
                      {c.phone && <span className="block text-xs text-gray-400">{c.phone}</span>}
                    </TableCell>
                    <TableCell className="px-4 text-right font-black text-amber-700 whitespace-nowrap">{money(c.debt)}</TableCell>
                    <TableCell className="px-4 text-right">
                      <FormDialog
                        key={c.debt}
                        trigger={C.repay}
                        title={C.repayTitle(c.name)}
                        description={`${C.debt}: ${money(c.debt)}`}
                        action={repayDebt}
                        submitLabel={C.repaySubmit}
                        submitClassName="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <input type="hidden" name="customerId" value={c.id} />
                        <Field label={`${C.repayAmount} (${t.common.currency})`}>
                          <Input name="amount" type="number" step="1" min="0" max={c.debt} required inputMode="numeric" defaultValue={c.debt} className={inputClass} />
                        </Field>
                        <Field label={t.common.note}>
                          <Input name="note" className={inputClass} placeholder={t.common.notePlaceholder} />
                        </Field>
                      </FormDialog>
                    </TableCell>
                  </TableRow>
                ))}
                {data.debtors.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="h-24 text-center text-gray-400 italic">{F.noDebtors}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-white overflow-hidden">
          <CardHeader className="border-b border-gray-50">
            <CardTitle className="text-lg text-gray-700">{F.paymentsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {data.payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="px-4 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(p.createdAt, locale)}</TableCell>
                    <TableCell className="px-4 font-bold text-gray-900">
                      {p.customerName}
                      {p.note && <span className="block text-xs font-normal text-gray-400">{p.note}</span>}
                    </TableCell>
                    <TableCell className="px-4 text-right font-black text-green-700 whitespace-nowrap">+{money(p.amount)}</TableCell>
                  </TableRow>
                ))}
                {data.payments.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="h-24 text-center text-gray-400 italic">{F.noPayments}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const TONES = {
  gray: "text-gray-900",
  green: "text-green-700",
  rose: "text-rose-700",
  indigo: "text-indigo-700",
  amber: "text-amber-700",
} as const

function Stat({ label, value, sub, tone = "gray" }: { label: string; value: string; sub?: string; tone?: keyof typeof TONES }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 min-w-0">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-xl md:text-2xl font-black mt-1 truncate ${TONES[tone]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}
