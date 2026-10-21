import { getSuppliers, getSupplierActivity, createSupplier, paySupplier, deleteSupplier } from "@/lib/actions/suppliers"
import { ActionForm } from "@/components/ui/action-form"
import { FormDialog } from "@/components/ui/form-dialog"
import { Field, inputClass } from "@/components/ui/field"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DeleteButton } from "@/components/ui/delete-button"
import { PageHeader, pageClass } from "@/components/PageHeader"
import { ExportButton } from "@/components/ExportButton"
import { getLocale, getT } from "@/i18n/server"
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format"
import { TruckIcon, PlusIcon, BanknoteIcon, PackageIcon, HistoryIcon } from "lucide-react"

export default async function SuppliersPage() {
  const [t, locale, suppliers, activity] = await Promise.all([getT(), getLocale(), getSuppliers(), getSupplierActivity(30)])
  const S = t.suppliers
  const totalDebt = suppliers.reduce((acc, s) => acc + Math.max(s.debt, 0), 0)

  return (
    <div className={pageClass}>
      <PageHeader icon={<TruckIcon className="text-teal-600" />} title={S.title} subtitle={S.subtitle}>
        <ExportButton kind="suppliers" />
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-sm border-none bg-white">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PlusIcon className="w-5 h-5 text-teal-600" />
                {S.newSupplier}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={createSupplier} successMessage={S.added} className="space-y-4">
                <Field label={S.name}>
                  <Input name="name" placeholder={S.namePlaceholder} required className={inputClass} />
                </Field>
                <Field label={t.common.phone}>
                  <Input name="phone" type="tel" placeholder="+998 90 123 45 67" className={inputClass} />
                </Field>
                <Field label={S.note}>
                  <Input name="note" placeholder={t.common.notePlaceholder} className={inputClass} />
                </Field>
                <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 font-bold h-11 text-white">{t.common.add}</Button>
              </ActionForm>
            </CardContent>
          </Card>

          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5">
            <p className="text-xs font-bold text-rose-700 uppercase tracking-widest">{S.totalOurDebt}</p>
            <p className="text-2xl font-black text-rose-700">{formatMoney(totalDebt, locale)}</p>
          </div>
          <p className="text-xs text-gray-500 px-1">{S.howTo}</p>
        </div>

        <div className="lg:col-span-3 space-y-6 min-w-0">
          <Card className="shadow-sm border-none bg-white overflow-hidden">
            <CardHeader className="border-b border-gray-50">
              <CardTitle className="text-lg text-gray-700">{S.list}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="px-4 font-bold">{S.name}</TableHead>
                    <TableHead className="px-4 font-bold">{t.common.phone}</TableHead>
                    <TableHead className="px-4 font-bold">{S.ourDebt}</TableHead>
                    <TableHead className="px-4 font-bold text-right">{t.common.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="px-4">
                        <div className="font-bold text-gray-900">{s.name}</div>
                        {s.note && <div className="text-xs text-gray-400">{s.note}</div>}
                      </TableCell>
                      <TableCell className="px-4 text-gray-500">{s.phone ?? t.common.none}</TableCell>
                      <TableCell className="px-4 whitespace-nowrap">
                        {s.debt > 0
                          ? <span className="font-black text-rose-700">{formatMoney(s.debt, locale)}</span>
                          : <span className="text-gray-400">{S.noDebt}</span>}
                      </TableCell>
                      <TableCell className="px-4">
                        <div className="flex justify-end gap-1.5">
                          {s.debt > 0 && (
                            <FormDialog
                              triggerClassName="gap-1 text-teal-700 border-teal-100 hover:bg-teal-50"
              trigger={<><BanknoteIcon className="w-3.5 h-3.5" />{S.pay}</>}
                              title={S.payTitle(s.name)}
                              description={`${S.ourDebt}: ${formatMoney(s.debt, locale)}`}
                              action={paySupplier}
                              submitLabel={S.paySubmit}
                              submitClassName="bg-teal-600 hover:bg-teal-700 text-white"
                            >
                              <input type="hidden" name="supplierId" value={s.id} />
                              <Field label={`${S.payAmount} (${t.common.currency})`}>
                                <Input key={s.debt} name="amount" type="number" step="0.01" min="0" max={s.debt} defaultValue={s.debt} required className={inputClass} />
                              </Field>
                              <Field label={t.common.note}>
                                <Input name="note" placeholder={t.common.notePlaceholder} className={inputClass} />
                              </Field>
                            </FormDialog>
                          )}
                          <DeleteButton action={deleteSupplier.bind(null, s.id)} confirmText={S.confirmDelete(s.name)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {suppliers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-gray-400 italic">{S.noSuppliers}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="shadow-sm border-none bg-white overflow-hidden">
              <CardHeader className="border-b border-gray-50">
                <CardTitle className="text-base text-gray-700 flex items-center gap-2"><PackageIcon className="w-4 h-4" />{S.purchasesTitle}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {activity.purchases.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="px-4">
                          <div className="text-xs text-gray-400">{formatDateTime(p.createdAt, locale)}</div>
                          <div className="font-bold text-gray-900">{p.supplierName}</div>
                          <div className="text-xs text-gray-500">{p.productName}: {formatNumber(p.quantity, locale)} {p.unit} × {formatMoney(p.unitCost, locale)}</div>
                        </TableCell>
                        <TableCell className="px-4 text-right font-black whitespace-nowrap">{formatMoney(p.total, locale)}</TableCell>
                      </TableRow>
                    ))}
                    {activity.purchases.length === 0 && (
                      <TableRow><TableCell className="h-20 text-center text-gray-400 italic">{S.noPurchases}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-none bg-white overflow-hidden">
              <CardHeader className="border-b border-gray-50">
                <CardTitle className="text-base text-gray-700 flex items-center gap-2"><HistoryIcon className="w-4 h-4" />{S.paymentsTitle}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {activity.payments.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="px-4">
                          <div className="text-xs text-gray-400">{formatDateTime(p.createdAt, locale)}</div>
                          <div className="font-bold text-gray-900">{p.supplierName}</div>
                          {p.note && <div className="text-xs text-gray-500">{p.note}</div>}
                        </TableCell>
                        <TableCell className="px-4 text-right font-black text-teal-700 whitespace-nowrap">{formatMoney(p.amount, locale)}</TableCell>
                      </TableRow>
                    ))}
                    {activity.payments.length === 0 && (
                      <TableRow><TableCell className="h-20 text-center text-gray-400 italic">{S.noPayments}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
