import { requireModule } from "@/lib/modules"
import { getFinancialSummary } from "@/lib/actions/reports"
import { DateRangeFilter } from "@/components/DateRangeFilter"
import { ExportButton } from "@/components/ExportButton"
import { PageHeader, pageClass } from "@/components/PageHeader"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { getLocale, getT } from "@/i18n/server"
import { formatMoney } from "@/lib/format"
import { BarChart3Icon, InfoIcon } from "lucide-react"

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  await requireModule("finance")
  const range = await searchParams
  const [t, locale, data] = await Promise.all([getT(), getLocale(), getFinancialSummary(range)])
  const R = t.reports
  const money = (n: number) => formatMoney(n, locale)
  const margin = data.revenue > 0 ? Math.round((data.grossProfit / data.revenue) * 100) : 0
  const maxExpense = Math.max(...data.expenseChart.map(e => e.value), 1)

  return (
    <div className={pageClass}>
      <PageHeader icon={<BarChart3Icon className="text-indigo-600" />} title={R.title} subtitle={R.subtitle}>
        <ExportButton kind="report" from={range.from} to={range.to} />
      </PageHeader>

      <DateRangeFilter basePath="/reports" from={range.from} to={range.to} />

      {/* Foyda zanjiri: daromad → tannarx → yalpi foyda → xarajatlar → sof foyda */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{R.period}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <Metric label={R.revenue} value={money(data.revenue)} hint={R.salesCount(data.salesLines)} tone="indigo" />
          <Metric label={R.cogs} value={`− ${money(data.cogs)}`} hint={R.cogsHint} />
          <Metric label={R.grossProfit} value={money(data.grossProfit)} hint={`${margin}%`} tone={data.grossProfit >= 0 ? "green" : "red"} />
          <Metric label={R.expenses} value={`− ${money(data.totalExpenses)}`} />
          <Metric label={R.adjustments} value={`− ${money(data.adjustmentsTotal)}`} />
          <Metric label={R.netProfit} value={money(data.netProfit)} hint={R.netProfitHint} tone={data.netProfit >= 0 ? "green" : "red"} big />
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Metric label={R.accruedWages} value={money(data.accruedWages)} hint={R.accruedWagesHint} />
        <Metric label={R.cashIn} value={money(data.cashIn)} hint={R.cashInHint} tone="green" />
        <Metric label={R.purchases} value={money(data.purchases)} hint={R.purchasesHint} />
        <Metric label={R.supplierPayments} value={money(data.supplierPayments)} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{R.currentState}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Metric label={R.inventoryValue} value={money(data.inventoryValue)} hint={R.inventoryValueHint} tone="indigo" />
          <Metric label={R.customerDebt} value={money(data.customerDebt)} tone="amber" />
          <Metric label={R.supplierDebt} value={money(data.supplierDebt)} tone="red" />
        </div>
      </section>

      <p className="text-sm text-gray-500 flex gap-2 bg-white rounded-2xl border border-gray-100 p-4">
        <InfoIcon className="w-5 h-5 shrink-0 text-indigo-400" />
        {R.howCalculated}
      </p>

      <Card className="rounded-3xl border-none shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="text-xl font-black">{R.expenseChart}</CardTitle>
          <CardDescription>{R.period}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.expenseChart
            .slice()
            .sort((a, b) => b.value - a.value)
            .map(ex => (
              <div key={ex.name} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-gray-700">{ex.name}</span>
                  <span className="font-black text-gray-900">{money(ex.value)}</span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: `${(ex.value / maxExpense) * 100}%` }} />
                </div>
              </div>
            ))}
          {data.expenseChart.length === 0 && (
            <p className="h-20 flex items-center justify-center text-gray-400 italic">{R.noExpenseData}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const TONES = {
  default: "text-gray-900",
  indigo: "text-indigo-700",
  green: "text-green-700",
  red: "text-rose-700",
  amber: "text-amber-700",
} as const

function Metric({
  label, value, hint, tone = "default", big,
}: {
  label: string
  value: string
  hint?: string
  tone?: keyof typeof TONES
  big?: boolean
}) {
  return (
    <div className={`rounded-2xl p-5 border ${big ? "bg-gray-900 border-gray-900" : "bg-white border-gray-100"} shadow-sm`}>
      <p className={`text-xs font-bold uppercase tracking-widest ${big ? "text-gray-400" : "text-gray-400"}`}>{label}</p>
      <p className={`mt-1 font-black ${big ? "text-3xl text-white" : `text-2xl ${TONES[tone]}`}`}>{value}</p>
      {hint && <p className={`mt-1 text-xs ${big ? "text-gray-400" : "text-gray-500"}`}>{hint}</p>}
    </div>
  )
}
