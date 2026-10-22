import { requireModule } from "@/lib/modules"
import { getProducts } from "@/lib/actions/products"
import { getWarehouses } from "@/lib/actions/warehouses"
import { getProductionLogs } from "@/lib/actions/production"
import { getActiveWorkers } from "@/lib/actions/workers"
import { getSessionUser, isManagement } from "@/lib/session"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ProductionForm } from "@/components/production/ProductionForm"
import { PageHeader, pageClass } from "@/components/PageHeader"
import { getLocale, getT } from "@/i18n/server"
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format"
import { HammerIcon, HistoryIcon, ArrowRightIcon } from "lucide-react"

export default async function ProductionPage() {
  await requireModule("bomProduction")
  const me = await getSessionUser()
  const manager = isManagement(me.role)
  const [t, locale, products, warehouses, workers, logs] = await Promise.all([
    getT(), getLocale(), getProducts(), getWarehouses(), manager ? getActiveWorkers() : Promise.resolve([]), getProductionLogs(),
  ])
  const P = t.production
  const finishedGoods = products.filter(p => !p.isRawMaterial)

  return (
    <div className={pageClass}>
      <PageHeader icon={<HammerIcon className="text-purple-600" />} title={P.title} subtitle={P.subtitle} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <Card className="lg:col-span-1 shadow-md border-none bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightIcon className="w-5 h-5 text-purple-600" />
              {P.newOrder}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProductionForm
              finishedGoods={finishedGoods.map(p => ({ id: p.id, name: p.name, unit: p.unit }))}
              warehouses={warehouses.map(w => ({ id: w.id, name: w.name }))}
              workers={workers.map(w => ({ id: w.id, name: w.name ?? w.email }))}
              chooseWorker={manager}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-sm border-none bg-white overflow-hidden min-w-0">
          <CardHeader className="border-b border-gray-50">
            <CardTitle className="flex items-center gap-2 text-gray-700">
              <HistoryIcon className="w-5 h-5" />
              {P.historyTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="px-4 font-bold">{t.common.date}</TableHead>
                  <TableHead className="px-4 font-bold">{t.common.product}</TableHead>
                  <TableHead className="px-4 font-bold">{P.colQty}</TableHead>
                  <TableHead className="px-4 font-bold">{P.colWorker}</TableHead>
                  <TableHead className="px-4 font-bold">{t.common.warehouse}</TableHead>
                  {manager && <TableHead className="px-4 font-bold">{P.colCost}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="px-4 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(log.createdAt, locale)}</TableCell>
                    <TableCell className="px-4 font-bold text-gray-900">{log.productName}</TableCell>
                    <TableCell className="px-4 font-bold text-purple-700 whitespace-nowrap">+{formatNumber(log.quantity, locale)} {log.unit}</TableCell>
                    <TableCell className="px-4 text-gray-600">{log.workerName ?? t.common.none}</TableCell>
                    <TableCell className="px-4 text-gray-500">{log.warehouseName ?? t.common.none}</TableCell>
                    {manager && (
                      <TableCell className="px-4 text-gray-500 whitespace-nowrap">{log.unitCost === null ? t.common.none : formatMoney(log.unitCost, locale)}</TableCell>
                    )}
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={manager ? 6 : 5} className="h-32 text-center text-gray-400 italic">{P.noHistory}</TableCell>
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
