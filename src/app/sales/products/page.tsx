import { requireModule } from "@/lib/modules"
import { getProducts } from "@/lib/actions/products"
import { getWarehouses } from "@/lib/actions/warehouses"
import { getCustomers } from "@/lib/actions/customers"
import { cancelSale, getSales } from "@/lib/actions/sales"
import { getSessionUser } from "@/lib/session"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { FormDialog } from "@/components/ui/form-dialog"
import { Field, inputClass } from "@/components/ui/field"
import { SaleForm } from "@/components/sales/SaleForm"
import { PageHeader, pageClass } from "@/components/PageHeader"
import { DateRangeFilter } from "@/components/DateRangeFilter"
import { ExportButton } from "@/components/ExportButton"
import { getLocale, getT } from "@/i18n/server"
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format"
import { ShoppingBagIcon, PlusIcon, Undo2Icon } from "lucide-react"

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  await requireModule("legacy")
  const me = await getSessionUser()
  const range = await searchParams
  const [t, locale, products, warehouses, customers, sales] = await Promise.all([
    getT(), getLocale(), getProducts(), getWarehouses(), getCustomers(), getSales(range),
  ])
  const S = t.sales

  // Rulonli xomashyo sotuv orqali chiqmaydi (rulonlar bilan qoldiq ajralib ketadi)
  const saleProducts = products
    .filter(p => !p.isRollTracked)
    .map(p => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      price: p.price ?? 0,
      stock: Object.fromEntries(p.stockLevels.map(sl => [sl.warehouseId, sl.quantity])),
    }))

  return (
    <div className={pageClass}>
      <PageHeader icon={<ShoppingBagIcon className="text-green-600" />} title={S.title} subtitle={S.subtitle}>
        <ExportButton kind="productSales" from={range.from} to={range.to} />
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <Card className="lg:col-span-2 shadow-sm border-none bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusIcon className="w-5 h-5 text-green-600" />
              {S.newSale}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SaleForm
              products={saleProducts}
              warehouses={warehouses.map(w => ({ id: w.id, name: w.name }))}
              customers={customers.map(c => ({ id: c.id, name: c.name }))}
            />
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-4 min-w-0">
          <DateRangeFilter basePath="/sales/products" from={range.from} to={range.to} />
          <Card className="shadow-sm border-none bg-white overflow-hidden">
            <CardHeader className="border-b border-gray-50">
              <CardTitle className="text-lg text-gray-700">{S.historyTitle}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="px-4 font-bold">{t.common.date}</TableHead>
                    <TableHead className="px-4 font-bold">{S.colItems}</TableHead>
                    <TableHead className="px-4 font-bold">{S.colTotal}</TableHead>
                    <TableHead className="px-4 font-bold">{S.colPayment}</TableHead>
                    <TableHead className="px-4 font-bold">{S.colStatus}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map(sale => {
                    const cancelled = sale.status === 'CANCELLED'
                    const debt = sale.totalAmount - sale.paidAmount
                    return (
                      <TableRow key={sale.id} className={cancelled ? "bg-gray-50 text-gray-400" : ""}>
                        <TableCell className="px-4 align-top">
                          <div className="text-xs whitespace-nowrap">{formatDateTime(sale.createdAt, locale)}</div>
                          <div className="font-bold text-gray-800">{sale.customerName ?? t.common.none}</div>
                          {sale.createdByName && <div className="text-[11px] text-gray-400">{S.by}: {sale.createdByName}</div>}
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          <ul className="space-y-0.5 text-sm">
                            {sale.items.map((item, i) => (
                              <li key={i}>
                                {item.productName} — {formatNumber(item.quantity, locale)} {item.unit} × {formatMoney(item.price, locale)}
                              </li>
                            ))}
                          </ul>
                          {sale.warehouseName && <div className="text-[11px] text-gray-400">{sale.warehouseName}</div>}
                        </TableCell>
                        <TableCell className="px-4 align-top whitespace-nowrap">
                          <div className={`font-black ${cancelled ? "line-through" : "text-gray-900"}`}>{formatMoney(sale.totalAmount, locale)}</div>
                          <div className="text-xs">{S.colPaid}: {formatMoney(sale.paidAmount, locale)}</div>
                          {debt > 0 && !cancelled && <div className="text-xs text-amber-700 font-bold">{t.customers.debt}: {formatMoney(debt, locale)}</div>}
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          <Badge variant="outline">{S.payment[sale.paymentType]}</Badge>
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          {cancelled ? (
                            <div className="space-y-1">
                              <Badge variant="outline" className="bg-gray-100 text-gray-500">{S.statusCancelled}</Badge>
                              {sale.cancelReason && <p className="text-[11px] max-w-40">{sale.cancelReason}</p>}
                            </div>
                          ) : me.role === 'ADMIN' ? (
                            <FormDialog
                              triggerClassName="gap-1 text-rose-600 border-rose-100 hover:bg-rose-50"
              trigger={<><Undo2Icon className="w-3.5 h-3.5" />{S.cancel}</>}
                              title={S.cancelTitle}
                              description={S.cancelHint}
                              action={cancelSale}
                              submitLabel={S.cancelSubmit}
                              submitClassName="bg-rose-600 hover:bg-rose-700 text-white"
                            >
                              <input type="hidden" name="saleId" value={sale.id} />
                              <Field label={S.cancelReason}>
                                <Input name="reason" required placeholder={S.cancelReasonPlaceholder} className={inputClass} />
                              </Field>
                            </FormDialog>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-100">{S.statusActive}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {sales.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-gray-400 italic">{S.noSales}</TableCell>
                    </TableRow>
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
