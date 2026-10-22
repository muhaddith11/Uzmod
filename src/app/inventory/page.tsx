import Link from "next/link"
import { getProducts, createProduct, deleteProduct, type ProductRow } from "@/lib/actions/products"
import { getWarehouses } from "@/lib/actions/warehouses"
import { getSupplierOptions } from "@/lib/actions/suppliers"
import { stockIn, stockAdjust, transferStock } from "@/lib/actions/stock"
import { getSessionUser, isManagement } from "@/lib/session"
import { getEnabledModules } from "@/lib/modules"
import { ActionForm } from "@/components/ui/action-form"
import { FormDialog } from "@/components/ui/form-dialog"
import { Field, NativeSelect, inputClass } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { DeleteButton } from "@/components/ui/delete-button"
import { PageHeader, pageClass } from "@/components/PageHeader"
import { ExportButton } from "@/components/ExportButton"
import { getLocale, getT } from "@/i18n/server"
import type { Messages } from "@/i18n/messages"
import type { Locale } from "@/i18n/locales"
import { formatMoney, formatNumber } from "@/lib/format"
import { Package2Icon, PlusIcon, BoxesIcon, LayersIcon, ArrowDownLeftIcon, ArrowRightLeftIcon, DiscIcon, ClipboardCheckIcon, Trash2Icon } from "lucide-react"

type Option = { id: string; name: string }

export default async function InventoryPage() {
  const me = await getSessionUser()
  const manager = isManagement(me.role)
  const modules = await getEnabledModules()
  const showRolls = modules.has("rolls")
  const showSuppliers = modules.has("suppliers")
  const [t, locale, products, warehouses, suppliers] = await Promise.all([
    getT(), getLocale(), getProducts(), getWarehouses(), manager && showSuppliers ? getSupplierOptions() : Promise.resolve([]),
  ])
  const L = t.inventory
  const rawMaterials = products.filter(p => p.isRawMaterial)
  const finishedGoods = products.filter(p => !p.isRawMaterial)
  const ctx = { t, locale, manager, warehouses, suppliers, showSuppliers }

  return (
    <div className={pageClass}>
      <PageHeader icon={<BoxesIcon className="text-indigo-600" />} title={L.title} subtitle={L.subtitle}>
        {manager && <ExportButton kind="stock" />}
      </PageHeader>

      <div className={`grid grid-cols-1 gap-8 items-start ${manager ? "xl:grid-cols-4" : ""}`}>
        {manager && (
          <Card className="xl:col-span-1 shadow-sm border-none bg-white">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PlusIcon className="w-5 h-5 text-indigo-600" />
                {L.newItem}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={createProduct} successMessage={L.created} className="space-y-4">
                <Field label={L.name}>
                  <Input name="name" placeholder={L.namePlaceholder} required className={inputClass} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={L.sku}>
                    <Input name="sku" placeholder="SKU-101" className={inputClass} />
                  </Field>
                  <Field label={L.unit}>
                    <Input name="unit" placeholder={L.unitPlaceholder} defaultValue="dona" required className={inputClass} list="unit-options" />
                    <datalist id="unit-options">
                      {Object.keys(t.common.units).map(u => <option key={u} value={u} />)}
                    </datalist>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={`${L.salePrice} (${t.common.currency})`}>
                    <Input name="price" type="number" step="0.01" min="0" required className={inputClass} placeholder="0" />
                  </Field>
                  <Field label={L.initialCost}>
                    <Input name="costPrice" type="number" step="0.01" min="0" className={inputClass} placeholder="0" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={L.wage}>
                    <Input name="productionWage" type="number" step="0.01" min="0" className={inputClass} placeholder="800" />
                  </Field>
                  <Field label={L.minStock}>
                    <Input name="minStockLevel" type="number" step="0.001" min="0" className={inputClass} placeholder="5" />
                  </Field>
                </div>
                <p className="text-xs text-gray-500">{L.initialCostHint}</p>
                <label className="flex items-center gap-2 pt-2 cursor-pointer">
                  <input type="checkbox" name="isRaw" className="w-5 h-5 accent-indigo-600 rounded border-gray-300" />
                  <span className="text-sm font-bold text-gray-700">{L.isRaw}</span>
                </label>
                {showRolls && <label className="flex items-start gap-2 rounded-xl bg-amber-50/60 border border-amber-100 p-3 cursor-pointer">
                  <input type="checkbox" name="isRollTracked" className="w-5 h-5 mt-0.5 accent-amber-600 rounded border-gray-300" />
                  <span>
                    <span className="text-sm font-bold text-gray-700 block">{L.isRollTracked}</span>
                    <span className="text-xs text-gray-500">{L.isRollTrackedHint}</span>
                  </span>
                </label>}
                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold h-11">
                  {L.addToCatalog}
                </Button>
              </ActionForm>
            </CardContent>
          </Card>
        )}

        <div className={manager ? "xl:col-span-3 min-w-0" : "min-w-0"}>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="bg-gray-100 p-1 rounded-xl mb-4 h-auto flex-wrap">
              <TabsTrigger value="all" className="rounded-lg px-4 md:px-6 py-1.5">{L.tabAll}</TabsTrigger>
              <TabsTrigger value="products" className="rounded-lg px-4 md:px-6 py-1.5">{L.tabProducts}</TabsTrigger>
              <TabsTrigger value="raw" className="rounded-lg px-4 md:px-6 py-1.5">{L.tabRaw}</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="mt-0"><ProductTable products={products} ctx={ctx} /></TabsContent>
            <TabsContent value="products" className="mt-0"><ProductTable products={finishedGoods} ctx={ctx} /></TabsContent>
            <TabsContent value="raw" className="mt-0"><ProductTable products={rawMaterials} ctx={ctx} /></TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

type Ctx = { t: Messages; locale: Locale; manager: boolean; warehouses: Option[]; suppliers: Option[]; showSuppliers: boolean }

function ProductTable({ products, ctx }: { products: ProductRow[]; ctx: Ctx }) {
  const { t, locale, manager } = ctx
  const L = t.inventory
  const columns = manager ? 6 : 3

  return (
    <Card className="shadow-sm border-none bg-white overflow-hidden">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50 border-none">
              <TableHead className="py-4 px-4 md:px-6 font-bold text-gray-600">{L.colItem}</TableHead>
              <TableHead className="py-4 px-4 md:px-6 font-bold text-gray-600">{L.colType}</TableHead>
              <TableHead className="py-4 px-4 md:px-6 font-bold text-gray-600">{L.colStock}</TableHead>
              {manager && <TableHead className="py-4 px-4 md:px-6 font-bold text-gray-600">{L.colCost}</TableHead>}
              {manager && <TableHead className="py-4 px-4 md:px-6 font-bold text-gray-600">{L.colPrice}</TableHead>}
              {manager && <TableHead className="py-4 px-4 md:px-6 text-right font-bold text-gray-600">{t.common.actions}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map(p => {
              const low = p.minStockLevel > 0 && p.totalQty <= p.minStockLevel
              return (
                <TableRow key={p.id} className="hover:bg-gray-50/50 border-b border-gray-100">
                  <TableCell className="py-4 px-4 md:px-6">
                    <Link href={`/inventory/${p.id}`} className="flex flex-col group/item">
                      <span className="font-bold text-gray-900 group-hover/item:text-indigo-600 transition-colors">{p.name}</span>
                      <span className="text-[11px] text-gray-400 font-bold uppercase">{p.sku || L.noSku}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="py-4 px-4 md:px-6">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className={`rounded-md px-2 py-1 ${p.isRawMaterial ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                        {p.isRawMaterial ? <LayersIcon className="w-3 h-3 mr-1" /> : <Package2Icon className="w-3 h-3 mr-1" />}
                        {p.isRawMaterial ? L.typeRaw : L.typeProduct}
                      </Badge>
                      {p.isRollTracked && (
                        <Badge variant="outline" className="rounded-md px-2 py-1 bg-amber-50 text-amber-700 border-amber-100">
                          <DiscIcon className="w-3 h-3 mr-1" />{L.typeRoll}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-4 px-4 md:px-6">
                    <div className="flex flex-col gap-1">
                      <span className={`text-lg font-bold whitespace-nowrap ${low || p.totalQty <= 0 ? "text-rose-600" : "text-gray-900"}`}>
                        {formatNumber(p.totalQty, locale)} {p.unit}
                        {p.totalQty <= 0 ? (
                          <span className="ml-2 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full align-middle">{L.outOfStock}</span>
                        ) : low ? (
                          <span className="ml-2 text-[10px] bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full border border-rose-100 align-middle">{L.lowStock}</span>
                        ) : null}
                      </span>
                      <div className="flex gap-1 flex-wrap">
                        {p.stockLevels.map(sl => (
                          <span key={sl.id} className="text-[11px] bg-gray-100 px-1.5 rounded text-gray-500 whitespace-nowrap">
                            {sl.warehouseName}: {formatNumber(sl.quantity, locale)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </TableCell>
                  {manager && (
                    <TableCell className="py-4 px-4 md:px-6 font-medium text-gray-500 whitespace-nowrap">{formatMoney(p.costPrice, locale)}</TableCell>
                  )}
                  {manager && (
                    <TableCell className="py-4 px-4 md:px-6 font-bold text-indigo-700 whitespace-nowrap">{formatMoney(p.price, locale)}</TableCell>
                  )}
                  {manager && (
                    <TableCell className="py-4 px-4 md:px-6 text-right">
                      <ProductActions product={p} ctx={ctx} />
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns} className="h-40 text-center text-gray-400 italic font-medium">{L.empty}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function WarehouseSelect({ name, warehouses, label }: { name: string; warehouses: Option[]; label: string }) {
  return (
    <Field label={label}>
      <NativeSelect name={name} required>
        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
      </NativeSelect>
    </Field>
  )
}

function ProductActions({ product: p, ctx }: { product: ProductRow; ctx: Ctx }) {
  const { t, warehouses, suppliers, showSuppliers } = ctx
  const L = t.inventory
  const triggerClass = "h-9 px-3 gap-1 font-bold"

  return (
    <div className="flex items-center justify-end gap-1.5 flex-wrap">
      {p.isRollTracked ? (
        <Link href="/rolls" className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-amber-100 text-amber-700 text-xs font-bold hover:bg-amber-50">
          <DiscIcon className="w-4 h-4" />{t.nav.rolls}
        </Link>
      ) : (
        <>
          <FormDialog
            triggerClassName={`${triggerClass} text-indigo-600 border-indigo-100 hover:bg-indigo-50`}
              trigger={<><ArrowDownLeftIcon className="w-4 h-4" />{L.stockIn}</>}
            title={L.stockInTitle(p.name)}
            action={stockIn}
            submitLabel={t.common.confirm}
          >
            <input type="hidden" name="productId" value={p.id} />
            <WarehouseSelect name="warehouseId" warehouses={warehouses} label={t.common.selectWarehouse} />
            <div className="grid grid-cols-2 gap-3">
              <Field label={`${t.common.quantity} (${p.unit})`}>
                <Input name="quantity" type="number" step="0.001" min="0" required className={inputClass} />
              </Field>
              <Field label={`${L.unitPrice} (${t.common.currency})`}>
                <Input key={p.costPrice ?? 0} name="unitPrice" type="number" step="0.01" min="0" required defaultValue={p.costPrice ?? undefined} className={inputClass} />
              </Field>
            </div>
            <p className="text-xs text-gray-500">{L.unitPriceHint}</p>
            {showSuppliers && (
              <>
                <Field label={t.common.supplier}>
                  <NativeSelect name="supplierId" defaultValue="">
                    <option value="">{L.noSupplier}</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </NativeSelect>
                </Field>
                <Field label={`${L.paidNow} (${t.common.currency})`} hint={L.paidNowHint}>
                  <Input name="paidAmount" type="number" step="0.01" min="0" className={inputClass} />
                </Field>
              </>
            )}
            <Field label={t.common.note}>
              <Input name="note" placeholder={t.common.notePlaceholder} className={inputClass} />
            </Field>
          </FormDialog>

          <FormDialog
            triggerClassName={`${triggerClass} text-sky-700 border-sky-100 hover:bg-sky-50`}
              trigger={<><ArrowRightLeftIcon className="w-4 h-4" />{L.transfer}</>}
            title={L.transferTitle(p.name)}
            action={transferStock}
            submitLabel={L.transferSubmit}
            submitClassName="bg-sky-600 hover:bg-sky-700 text-white"
          >
            <input type="hidden" name="productId" value={p.id} />
            <WarehouseSelect name="fromWarehouseId" warehouses={warehouses} label={L.fromWarehouse} />
            <WarehouseSelect name="toWarehouseId" warehouses={warehouses} label={L.toWarehouse} />
            <Field label={`${t.common.quantity} (${p.unit})`}>
              <Input name="quantity" type="number" step="0.001" min="0" required className={inputClass} />
            </Field>
            <Field label={t.common.note}>
              <Input name="note" placeholder={t.common.notePlaceholder} className={inputClass} />
            </Field>
          </FormDialog>

          <FormDialog
            triggerClassName={`${triggerClass} text-orange-600 border-orange-100 hover:bg-orange-50`}
              trigger={<><Trash2Icon className="w-4 h-4" />{L.wastage}</>}
            title={L.wastageTitle(p.name)}
            action={stockAdjust}
            submitLabel={L.wastageSubmit}
            submitClassName="bg-orange-600 hover:bg-orange-700 text-white"
          >
            <input type="hidden" name="productId" value={p.id} />
            <input type="hidden" name="type" value="WASTAGE" />
            <WarehouseSelect name="warehouseId" warehouses={warehouses} label={t.common.selectWarehouse} />
            <Field label={`${L.wastageQty} (${p.unit})`}>
              <Input name="quantity" type="number" step="0.001" min="0" required className={inputClass} placeholder="5" />
            </Field>
            <Field label={L.reasonRequired}>
              <Input name="note" placeholder={L.wastagePlaceholder} required className={`${inputClass} bg-orange-50 border-orange-200`} />
            </Field>
          </FormDialog>

          <FormDialog
            triggerClassName={`${triggerClass} text-emerald-600 border-emerald-100 hover:bg-emerald-50`}
              trigger={<><ClipboardCheckIcon className="w-4 h-4" />{L.revision}</>}
            title={L.revisionTitle(p.name)}
            action={stockAdjust}
            submitLabel={L.revisionSubmit}
            submitClassName="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <input type="hidden" name="productId" value={p.id} />
            <input type="hidden" name="type" value="REVISION" />
            <WarehouseSelect name="warehouseId" warehouses={warehouses} label={t.common.warehouse} />
            <Field label={`${L.actualQty} (${p.unit})`}>
              <Input name="quantity" type="number" step="0.001" min="0" required className={inputClass} placeholder="10" />
            </Field>
            <Field label={L.reasonRequired}>
              <Input name="note" placeholder={L.revisionPlaceholder} required className={`${inputClass} bg-emerald-50 border-emerald-200`} />
            </Field>
          </FormDialog>
        </>
      )}

      <DeleteButton
        action={deleteProduct.bind(null, p.id)}
        confirmText={L.confirmDeleteProduct(p.name)}
        className="text-red-400 hover:text-red-600 hover:bg-red-50"
      />
    </div>
  )
}
