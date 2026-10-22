import { requireModule } from "@/lib/modules"
import { getSessionUser } from "@/lib/session"
import { cancelStockSale, getSaleOptions, getStockSales } from "@/lib/actions/stock-sales"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DeleteButton } from "@/components/ui/delete-button"
import { StockSaleForm } from "@/components/sales/StockSaleForm"
import { PageHeader, pageClass } from "@/components/PageHeader"
import { DateRangeFilter } from "@/components/DateRangeFilter"
import { ExportButton } from "@/components/ExportButton"
import { getLocale, getT } from "@/i18n/server"
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format"
import { resolveRange } from "@/lib/attendance"
import { ShoppingBagIcon, PlusIcon, InfoIcon } from "lucide-react"

const KIND_TONE = { FINISHED: "bg-indigo-50 text-indigo-700", DEFECT: "bg-rose-50 text-rose-700", YARN: "bg-teal-50 text-teal-700" } as const

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  await requireModule("sales")
  const me = await getSessionUser()
  const range = resolveRange(await searchParams)
  const [t, locale, options, sales] = await Promise.all([getT(), getLocale(), getSaleOptions(), getStockSales(range)])
  const S = t.stockSales
  const fmt = (n: number) => formatNumber(n, locale)

  return (
    <div className={pageClass}>
      <PageHeader icon={<ShoppingBagIcon className="text-green-600" />} title={S.title} subtitle={S.subtitle}>
        <ExportButton kind="sales" from={range.from} to={range.to} />
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <Card className="lg:col-span-2 shadow-sm border-none bg-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><PlusIcon className="w-5 h-5 text-green-600" />{S.newSale}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StockSaleForm items={options.items} customers={options.customers} />
            <p className="text-xs text-gray-500 flex gap-1.5"><InfoIcon className="w-4 h-4 shrink-0 text-gray-400" />{S.debtsHint}</p>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-6 min-w-0">
          <DateRangeFilter basePath="/sales" from={range.from} to={range.to} allowAllTime={false} />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Mini label={S.soldKg} value={`${fmt(sales.totals.kg)} kg`} />
            <Mini label={S.revenue} value={formatMoney(sales.totals.total, locale)} />
            <Mini label={S.received} value={formatMoney(sales.totals.paid, locale)} />
            <Mini label={S.onCredit} value={formatMoney(sales.totals.debt, locale)} warn={sales.totals.debt > 0} />
          </div>

          <Card className="shadow-sm border-none bg-white overflow-hidden">
            <CardHeader className="border-b border-gray-50">
              <CardTitle className="text-lg text-gray-700">{S.list}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="px-4 font-bold">{t.common.date}</TableHead>
                    <TableHead className="px-4 font-bold">{S.colItem}</TableHead>
                    <TableHead className="px-4 font-bold text-right">{S.colKg}</TableHead>
                    <TableHead className="px-4 font-bold text-right">{S.colTotal}</TableHead>
                    <TableHead className="px-4 font-bold text-right">{S.colDebt}</TableHead>
                    <TableHead className="px-4 font-bold">{S.colCustomer}</TableHead>
                    {me.role === "ADMIN" && <TableHead className="px-4" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.rows.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="px-4 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(s.createdAt, locale)}</TableCell>
                      <TableCell className="px-4">
                        <span className={`text-[10px] font-bold uppercase rounded px-1.5 py-0.5 mr-1.5 ${KIND_TONE[s.kind]}`}>{S.kinds[s.kind]}</span>
                        <span className="text-sm font-semibold text-gray-900">{s.label}</span>
                        {s.note && <span className="block text-xs text-gray-400">{s.note}</span>}
                      </TableCell>
                      <TableCell className="px-4 text-right font-mono">
                        {fmt(s.kg)}
                        {s.socks !== null && <span className="block text-[11px] text-gray-400">≈ {fmt(s.socks)}</span>}
                      </TableCell>
                      <TableCell className="px-4 text-right font-bold whitespace-nowrap">{formatMoney(s.total, locale)}</TableCell>
                      <TableCell className={`px-4 text-right whitespace-nowrap ${s.debt > 0 ? "text-amber-700 font-bold" : "text-gray-400"}`}>
                        {s.debt > 0 ? formatMoney(s.debt, locale) : t.common.none}
                      </TableCell>
                      <TableCell className="px-4 text-sm text-gray-600">{s.customerName ?? t.common.none}</TableCell>
                      {me.role === "ADMIN" && (
                        <TableCell className="px-4 text-right">
                          <DeleteButton action={cancelStockSale.bind(null, s.id)} confirmText={S.confirmCancel} />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {sales.rows.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="h-28 text-center text-gray-400 italic">{S.noSales}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Mini({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 min-w-0">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-black truncate ${warn ? "text-amber-700" : "text-gray-900"}`}>{value}</p>
    </div>
  )
}
