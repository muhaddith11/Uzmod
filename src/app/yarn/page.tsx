import { getYarnStock } from "@/lib/actions/yarn"
import { getWarehouses } from "@/lib/actions/warehouses"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { YarnReceiveForm } from "@/components/yarn/YarnReceiveForm"
import { YarnCalculator } from "@/components/yarn/YarnCalculator"
import { PageHeader, pageClass } from "@/components/PageHeader"
import { getLocale, getT } from "@/i18n/server"
import { formatMoney, formatNumber } from "@/lib/format"
import { colorHex } from "@/lib/domain/machines"
import { PackageOpenIcon, PlusIcon, CalculatorIcon } from "lucide-react"

export default async function YarnPage() {
  const [t, locale, stock, warehouses] = await Promise.all([getT(), getLocale(), getYarnStock(), getWarehouses()])
  const Y = t.yarn

  const types = [...new Set([...Y.defaultTypes, ...stock.map(s => s.yarnType)])].filter(Boolean)
  const colors = [...new Set([...Y.defaultColors, ...stock.map(s => s.color)])].filter(Boolean)
  const lastPrice = Object.fromEntries(stock.map(s => [`${s.yarnType.toLowerCase()}|${s.color.toLowerCase()}`, s.costPerKg]))
  const totalKg = stock.reduce((acc, s) => acc + s.stockKg, 0)
  const todayKg = stock.reduce((acc, s) => acc + s.todayKg, 0)

  return (
    <div className={pageClass}>
      <PageHeader icon={<PackageOpenIcon className="text-teal-600" />} title={Y.title} subtitle={Y.subtitle} />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <Card className="lg:col-span-2 shadow-sm border-none bg-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><PlusIcon className="w-5 h-5 text-teal-600" />{Y.receiveTitle}</CardTitle>
            <CardDescription>{Y.receiveHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <YarnReceiveForm types={types} colors={colors} lastPrice={lastPrice} warehouses={warehouses.map(w => ({ id: w.id, name: w.name }))} />
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-6 min-w-0">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{Y.stockTitle}</p>
              <p className="text-2xl font-black text-gray-900">{formatNumber(totalKg, locale)} kg</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{Y.colToday}</p>
              <p className="text-2xl font-black text-teal-700">{formatNumber(todayKg, locale)} kg</p>
            </div>
          </div>

          <Card className="shadow-sm border-none bg-white overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="px-4 font-bold">{Y.type}</TableHead>
                    <TableHead className="px-4 font-bold">{Y.color}</TableHead>
                    <TableHead className="px-4 font-bold text-right">{Y.colStock}</TableHead>
                    <TableHead className="px-4 font-bold text-right">{Y.colToday}</TableHead>
                    <TableHead className="px-4 font-bold text-right">{Y.colInMachines}</TableHead>
                    <TableHead className="px-4 font-bold text-right">{Y.colCost}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stock.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="px-4 font-bold text-gray-900">{s.yarnType}</TableCell>
                      <TableCell className="px-4">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full border border-gray-300" style={{ background: colorHex(s.color) }} />
                          {s.color}
                        </span>
                      </TableCell>
                      <TableCell className={`px-4 text-right font-mono font-black ${s.stockKg <= 0 ? "text-rose-600" : "text-gray-900"}`}>{formatNumber(s.stockKg, locale)}</TableCell>
                      <TableCell className="px-4 text-right font-mono text-teal-700">{s.todayKg > 0 ? `+${formatNumber(s.todayKg, locale)}` : t.common.none}</TableCell>
                      <TableCell className="px-4 text-right font-mono text-gray-500">{s.inMachinesKg > 0 ? formatNumber(s.inMachinesKg, locale) : t.common.none}</TableCell>
                      <TableCell className="px-4 text-right whitespace-nowrap text-gray-500">{formatMoney(s.costPerKg, locale)}</TableCell>
                    </TableRow>
                  ))}
                  {stock.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="h-28 text-center text-gray-400 italic">{Y.noYarn}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {stock.length > 0 && (
            <Card className="shadow-sm border-none bg-white">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><CalculatorIcon className="w-5 h-5 text-indigo-600" />{Y.calcTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <YarnCalculator yarns={stock.map(s => ({ id: s.id, name: s.name, color: s.color, stockKg: s.stockKg }))} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
