import { requireModule } from "@/lib/modules"
import { getCustomers, createCustomer, deleteCustomer, repayDebt, getDebtPayments } from "@/lib/actions/customers"
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
import { formatDateTime, formatMoney } from "@/lib/format"
import { UsersIcon, UserPlusIcon, BanknoteIcon, HistoryIcon } from "lucide-react"

export default async function CustomersPage() {
  await requireModule("legacy")
  const [t, locale, customers, payments] = await Promise.all([getT(), getLocale(), getCustomers(), getDebtPayments(30)])
  const C = t.customers
  const totalDebt = customers.reduce((acc, c) => acc + Math.max(c.debt, 0), 0)

  return (
    <div className={pageClass}>
      <PageHeader icon={<UsersIcon className="text-blue-600" />} title={C.title} subtitle={C.subtitle}>
        <ExportButton kind="customers" />
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-sm border-none bg-white">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlusIcon className="w-5 h-5 text-blue-600" />
                {C.newCustomer}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={createCustomer} successMessage={C.added} className="space-y-4">
                <Field label={C.name}>
                  <Input name="name" placeholder={C.namePlaceholder} required className={inputClass} />
                </Field>
                <Field label={t.common.phone}>
                  <Input name="phone" type="tel" placeholder={C.phonePlaceholder} className={inputClass} />
                </Field>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 font-bold h-11">{t.common.add}</Button>
              </ActionForm>
            </CardContent>
          </Card>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">{C.totalDebt}</p>
            <p className="text-2xl font-black text-amber-700">{formatMoney(totalDebt, locale)}</p>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6 min-w-0">
          <Card className="shadow-sm border-none bg-white overflow-hidden">
            <CardHeader className="border-b border-gray-50">
              <CardTitle className="text-lg text-gray-700">{C.list}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="px-4 font-bold">{t.common.customer}</TableHead>
                    <TableHead className="px-4 font-bold">{t.common.phone}</TableHead>
                    <TableHead className="px-4 font-bold">{C.debt}</TableHead>
                    <TableHead className="px-4 font-bold text-right">{t.common.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="px-4 font-bold text-gray-900">{c.name}</TableCell>
                      <TableCell className="px-4 text-gray-500">{c.phone ?? t.common.none}</TableCell>
                      <TableCell className="px-4 whitespace-nowrap">
                        {c.debt > 0 ? (
                          <span className="font-black text-amber-700">{formatMoney(c.debt, locale)}</span>
                        ) : c.debt < 0 ? (
                          <span className="font-bold text-green-700">{C.advance}: {formatMoney(-c.debt, locale)}</span>
                        ) : (
                          <span className="text-gray-400">{C.noDebt}</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4">
                        <div className="flex justify-end gap-1.5">
                          {c.debt > 0 && (
                            <FormDialog
                              triggerClassName="gap-1 text-green-700 border-green-100 hover:bg-green-50"
              trigger={<><BanknoteIcon className="w-3.5 h-3.5" />{C.repay}</>}
                              title={C.repayTitle(c.name)}
                              description={`${C.currentDebt}: ${formatMoney(c.debt, locale)}`}
                              action={repayDebt}
                              submitLabel={C.repaySubmit}
                              submitClassName="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <input type="hidden" name="customerId" value={c.id} />
                              <Field label={`${C.repayAmount} (${t.common.currency})`}>
                                <Input key={c.debt} name="amount" type="number" step="0.01" min="0" max={c.debt} defaultValue={c.debt} required className={inputClass} />
                              </Field>
                              <Field label={t.common.note}>
                                <Input name="note" placeholder={t.common.notePlaceholder} className={inputClass} />
                              </Field>
                            </FormDialog>
                          )}
                          <DeleteButton action={deleteCustomer.bind(null, c.id)} confirmText={C.confirmDelete(c.name)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {customers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-gray-400 italic">{C.noCustomers}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-none bg-white overflow-hidden">
            <CardHeader className="border-b border-gray-50">
              <CardTitle className="text-lg text-gray-700 flex items-center gap-2"><HistoryIcon className="w-5 h-5" />{C.paymentsTitle}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  {payments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="px-4 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(p.createdAt, locale)}</TableCell>
                      <TableCell className="px-4 font-bold">{p.customerName}</TableCell>
                      <TableCell className="px-4 font-black text-green-700 whitespace-nowrap">+{formatMoney(p.amount, locale)}</TableCell>
                      <TableCell className="px-4 text-gray-500 text-sm">{p.note ?? ""}</TableCell>
                      <TableCell className="px-4 text-gray-400 text-xs">{p.createdByName ?? ""}</TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 && (
                    <TableRow>
                      <TableCell className="h-20 text-center text-gray-400 italic">{C.noPayments}</TableCell>
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
