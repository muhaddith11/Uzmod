import { requireModule } from "@/lib/modules"
import { getProducts } from "@/lib/actions/products"
import { getWarehouses } from "@/lib/actions/warehouses"
import { getSupplierOptions } from "@/lib/actions/suppliers"
import { getRolls, createRolls, finishRoll, transferRolls } from "@/lib/actions/rolls"
import { getSessionUser, isManagement } from "@/lib/session"
import { ActionForm } from "@/components/ui/action-form"
import { ActionButton } from "@/components/ui/action-button"
import { Field, NativeSelect, inputClass } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { PageHeader, pageClass } from "@/components/PageHeader"
import { getLocale, getT } from "@/i18n/server"
import { formatNumber } from "@/lib/format"
import { DiscIcon, PlusIcon, ArrowRightLeftIcon, CircleSlashIcon } from "lucide-react"

const STATUS_CLASS: Record<string, string> = {
  AVAILABLE: "bg-emerald-50 text-emerald-700 border-emerald-100",
  IN_USE: "bg-amber-50 text-amber-700 border-amber-100",
  FINISHED: "bg-gray-100 text-gray-500 border-gray-200",
}

export default async function RollsPage() {
  await requireModule("rolls")
  const me = await getSessionUser()
  const manager = isManagement(me.role)
  const [t, locale, products, warehouses, rolls, suppliers] = await Promise.all([
    getT(), getLocale(), getProducts(), getWarehouses(), getRolls(), manager ? getSupplierOptions() : Promise.resolve([]),
  ])
  const R = t.rolls
  const rollMaterials = products.filter(p => p.isRawMaterial && p.isRollTracked)

  // Birlik bo'yicha jami (kg va metr aralashmasin)
  const totals = new Map<string, number>()
  for (const r of rolls) totals.set(r.unit, (totals.get(r.unit) ?? 0) + r.currentWeight)

  return (
    <div className={pageClass}>
      <PageHeader icon={<DiscIcon className="text-amber-600" />} title={R.title} subtitle={R.subtitle} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        <Card className="lg:col-span-1 shadow-sm border-none bg-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PlusIcon className="w-5 h-5 text-amber-600" />
              {R.receive}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rollMaterials.length === 0 ? (
              <p className="text-sm text-gray-500">{R.noRollMaterials}</p>
            ) : (
              <ActionForm action={createRolls} successMessage={R.received} className="space-y-4">
                <Field label={R.material}>
                  <NativeSelect name="productId" required defaultValue="">
                    <option value="" disabled>{t.common.select}</option>
                    {rollMaterials.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                  </NativeSelect>
                </Field>
                <Field label={t.common.warehouse}>
                  <NativeSelect name="warehouseId" required>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </NativeSelect>
                </Field>
                <Field label={R.weights} hint={R.weightsHint}>
                  <Input name="weights" required placeholder={R.weightsPlaceholder} className={inputClass} />
                </Field>
                {manager ? (
                  <>
                    <Field label={`${t.inventory.unitPrice} (${t.common.currency})`} hint={t.inventory.unitPriceHint}>
                      <Input name="unitPrice" type="number" step="0.01" min="0" required className={inputClass} />
                    </Field>
                    <Field label={t.common.supplier}>
                      <NativeSelect name="supplierId" defaultValue="">
                        <option value="">{t.inventory.noSupplier}</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </NativeSelect>
                    </Field>
                    <Field label={`${t.inventory.paidNow} (${t.common.currency})`} hint={t.inventory.paidNowHint}>
                      <Input name="paidAmount" type="number" step="0.01" min="0" className={inputClass} />
                    </Field>
                  </>
                ) : (
                  <p className="text-xs text-gray-500">{R.workerNoPrice}</p>
                )}
                <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 font-bold h-11 text-white">
                  {R.receiveSubmit}
                </Button>
              </ActionForm>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-sm border-none bg-white overflow-hidden min-w-0">
          <CardHeader className="border-b border-gray-50 flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-lg font-bold text-gray-700">{R.openRolls}</CardTitle>
            <div className="text-right">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{R.totalLeft}</p>
              <p className="text-xl font-black text-amber-600">
                {[...totals.entries()].map(([unit, total]) => `${formatNumber(total, locale)} ${unit}`).join(" · ") || "0"}
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Ko'chirish formasi butun jadvalni o'raydi — belgilangan rulonlar birga yuboriladi */}
            <ActionForm action={transferRolls} successMessage={R.moved}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50 border-none hover:bg-gray-50/50">
                    {manager && <TableHead className="py-4 pl-4 w-10" />}
                    <TableHead className="py-4 px-4 font-bold text-gray-600">{R.material}</TableHead>
                    <TableHead className="py-4 px-4 font-bold text-gray-600">{t.common.warehouse}</TableHead>
                    <TableHead className="py-4 px-4 font-bold text-gray-600">{R.colStatus}</TableHead>
                    <TableHead className="py-4 px-4 font-bold text-gray-600 min-w-48">{R.colLeft}</TableHead>
                    {manager && <TableHead className="py-4 px-4 font-bold text-gray-600 text-right">{t.common.actions}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rolls.map(r => {
                    const percent = r.initialWeight > 0 ? Math.round((r.currentWeight / r.initialWeight) * 100) : 0
                    const left = `${formatNumber(r.currentWeight, locale)} ${r.unit}`
                    return (
                      <TableRow key={r.id} className="hover:bg-gray-50/50 border-b border-gray-100">
                        {manager && (
                          <TableCell className="py-4 pl-4">
                            <input type="checkbox" name="rollId" value={r.id} aria-label={r.productName} className="w-4 h-4 accent-indigo-600" />
                          </TableCell>
                        )}
                        <TableCell className="py-4 px-4 font-bold text-gray-900">{r.productName}</TableCell>
                        <TableCell className="py-4 px-4 text-gray-500 font-medium">{r.warehouseName}</TableCell>
                        <TableCell className="py-4 px-4">
                          <Badge variant="outline" className={`rounded-md px-2 py-1 ${STATUS_CLASS[r.status]}`}>{R.status[r.status]}</Badge>
                        </TableCell>
                        <TableCell className="py-4 px-4">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-bold">
                              <span className="text-gray-900">{left}</span>
                              <span className="text-gray-400">/ {formatNumber(r.initialWeight, locale)} {r.unit}</span>
                            </div>
                            <Progress value={percent} className="h-2" />
                          </div>
                        </TableCell>
                        {manager && (
                          <TableCell className="py-4 px-4 text-right">
                            <ActionButton
                              action={finishRoll.bind(null, r.id)}
                              confirmText={R.confirmFinish(left)}
                              variant="ghost"
                              size="sm"
                              className="text-gray-500 hover:text-rose-600 hover:bg-rose-50 gap-1"
                            >
                              <CircleSlashIcon className="w-4 h-4" /> {R.finish}
                            </ActionButton>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                  {rolls.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={manager ? 6 : 4} className="h-40 text-center text-gray-400 italic">{R.noOpenRolls}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {manager && rolls.length > 0 && (
                <div className="flex flex-wrap items-end gap-3 p-4 border-t border-gray-100 bg-gray-50/50">
                  <Field label={R.moveTo} className="min-w-56">
                    <NativeSelect name="toWarehouseId" required className="bg-white">
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </NativeSelect>
                  </Field>
                  <Button type="submit" className="h-11 bg-sky-600 hover:bg-sky-700 text-white font-bold gap-1">
                    <ArrowRightLeftIcon className="w-4 h-4" /> {R.moveSelected}
                  </Button>
                </div>
              )}
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
