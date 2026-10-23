import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getSessionUser, isManagement } from "@/lib/session"
import { addBOMItem, deleteBOMItem } from "@/lib/actions/bom"
import { updateProduct } from "@/lib/actions/products"
import { ActionForm } from "@/components/ui/action-form"
import { Field, NativeSelect, inputClass } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DeleteButton } from "@/components/ui/delete-button"
import { getLocale, getT } from "@/i18n/server"
import { formatMoney, formatNumber } from "@/lib/format"
import { productionUnitCost } from "@/lib/domain/costing"
import { Package2Icon, PlusIcon, Settings2Icon, ArrowLeftIcon, LayersIcon } from "lucide-react"

export default async function ProductDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getSessionUser()
  const manager = isManagement(me.role)
  const [t, locale] = await Promise.all([getT(), getLocale()])
  const L = t.inventory

  const product = await prisma.product.findFirst({
    where: { id, organizationId: me.organizationId },
    include: { bomItems: { include: { material: true } } }
  })
  if (!product) notFound()

  const materials = product.isRawMaterial ? [] : await prisma.product.findMany({
    where: { organizationId: me.organizationId, isRawMaterial: true },
    select: { id: true, name: true, unit: true },
    orderBy: { name: 'asc' }
  })

  const unitCost = productionUnitCost(
    product.bomItems.map(b => ({ quantityNeeded: b.quantityNeeded, materialCost: Number(b.material.costPrice) })),
    Number(product.productionWage),
  )

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <Link href="/inventory" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-indigo-600">
        <ArrowLeftIcon className="w-4 h-4" /> {L.back}
      </Link>

      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
          {product.isRawMaterial ? <LayersIcon className="w-7 h-7" /> : <Package2Icon className="w-7 h-7" />}
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{product.name}</h1>
          <p className="text-gray-500">{product.isRawMaterial ? L.typeRaw : L.typeProduct} · {product.sku || L.noSku}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {manager && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings2Icon className="w-5 h-5 text-indigo-600" /> {L.detailsTitle}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={updateProduct} successMessage={L.editSaved} className="space-y-4">
                <input type="hidden" name="id" value={product.id} />
                <Field label={L.name}>
                  <Input key={product.name} name="name" defaultValue={product.name} required className={inputClass} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={L.sku}>
                    <Input key={product.sku ?? ""} name="sku" defaultValue={product.sku ?? ""} className={inputClass} />
                  </Field>
                  <Field label={L.unit}>
                    <Input key={product.unit} name="unit" defaultValue={product.unit} required className={inputClass} />
                  </Field>
                </div>
                <Field label={`${L.salePrice} (${t.common.currency})`}>
                  <Input key={Number(product.price)} name="price" type="number" step="0.01" min="0" defaultValue={Number(product.price)} required className={inputClass} />
                </Field>
                {!product.isRawMaterial && (
                  <Field label={L.wage}>
                    <Input key={Number(product.productionWage)} name="productionWage" type="number" step="0.01" min="0" defaultValue={Number(product.productionWage)} className={inputClass} />
                  </Field>
                )}
                <Field label={L.minStock}>
                  <Input key={Number(product.minStockLevel)} name="minStockLevel" type="number" step="0.001" min="0" defaultValue={Number(product.minStockLevel)} className={inputClass} />
                </Field>
                <div className="rounded-xl bg-gray-50 p-3 text-sm">
                  <p className="text-gray-500">{L.currentCost}</p>
                  <p className="font-bold text-gray-900">{formatMoney(product.costPrice, locale)}</p>
                </div>
                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold h-11">{t.common.save}</Button>
              </ActionForm>
            </CardContent>
          </Card>
        )}

        {!product.isRawMaterial && (
          <Card className={`${manager ? "lg:col-span-2" : "lg:col-span-3"}`}>
            <CardHeader>
              <CardTitle className="text-lg">{L.bomTitle}</CardTitle>
              <CardDescription>{L.bomSubtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {manager && (
                <ActionForm action={addBOMItem} className="grid grid-cols-1 sm:grid-cols-[1fr_10rem_auto] gap-3 items-end">
                  <input type="hidden" name="productId" value={product.id} />
                  <Field label={L.bomMaterial}>
                    <NativeSelect name="materialId" required defaultValue="">
                      <option value="" disabled>{t.common.select}</option>
                      {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                    </NativeSelect>
                  </Field>
                  <Field label={L.bomQty}>
                    <Input name="quantityNeeded" type="number" step="0.0001" min="0" required className={inputClass} placeholder="0.05" />
                  </Field>
                  <Button type="submit" className="h-11 bg-indigo-600 hover:bg-indigo-700 font-bold gap-1">
                    <PlusIcon className="w-4 h-4" /> {L.bomAdd}
                  </Button>
                </ActionForm>
              )}

              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>{L.bomMaterial}</TableHead>
                    <TableHead>{L.bomQty}</TableHead>
                    {manager && <TableHead>{L.colCost}</TableHead>}
                    {manager && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.bomItems.map(b => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.material.name}</TableCell>
                      <TableCell>{formatNumber(b.quantityNeeded, locale, 4)} {b.material.unit}</TableCell>
                      {manager && <TableCell>{formatMoney(b.quantityNeeded * Number(b.material.costPrice), locale)}</TableCell>}
                      {manager && (
                        <TableCell className="text-right">
                          <DeleteButton action={deleteBOMItem.bind(null, b.id)} confirmText={L.confirmDeleteBom} />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {product.bomItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={manager ? 4 : 2} className="h-24 text-center text-gray-400 italic">{L.bomEmpty}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {manager && product.bomItems.length > 0 && (
                <div className="rounded-xl bg-indigo-50 p-4 flex flex-wrap justify-between gap-2 text-sm">
                  <span className="text-indigo-900 font-semibold">{L.bomUnitCost}</span>
                  <span className="font-black text-indigo-700">{formatMoney(unitCost.total, locale)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
