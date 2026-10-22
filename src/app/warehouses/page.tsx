import { requireModule } from "@/lib/modules"
import { getWarehouses, createWarehouse, deleteWarehouse } from "@/lib/actions/warehouses"
import { ActionForm } from "@/components/ui/action-form"
import { Field, inputClass } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { DeleteButton } from "@/components/ui/delete-button"
import { PageHeader } from "@/components/PageHeader"
import { getT } from "@/i18n/server"
import { WarehouseIcon, PlusIcon, MapPinIcon } from "lucide-react"

export default async function WarehousesPage() {
  await requireModule("legacy")
  const [t, warehouses] = await Promise.all([getT(), getWarehouses()])
  const W = t.warehouses

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <PageHeader icon={<WarehouseIcon className="text-blue-600" />} title={W.title} subtitle={W.subtitle} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        <Card className="md:col-span-1 shadow-sm border-none bg-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PlusIcon className="w-5 h-5 text-blue-600" />
              {W.newWarehouse}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createWarehouse} successMessage={W.added} className="space-y-4">
              <Field label={W.name}>
                <Input name="name" placeholder={W.namePlaceholder} required className={inputClass} />
              </Field>
              <Field label={W.address}>
                <Input name="address" placeholder={W.addressPlaceholder} className={inputClass} />
              </Field>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 font-bold h-11">{t.common.add}</Button>
            </ActionForm>
          </CardContent>
        </Card>

        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {warehouses.map(w => (
            <Card key={w.id} className="shadow-sm border-none bg-white">
              <CardContent className="pt-6 flex justify-between items-start gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-3 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                    <WarehouseIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{w.name}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPinIcon className="w-3 h-3 shrink-0" /> {w.address || W.noAddress}
                    </p>
                  </div>
                </div>
                <DeleteButton action={deleteWarehouse.bind(null, w.id)} confirmText={W.confirmDelete(w.name)} />
              </CardContent>
            </Card>
          ))}
          {warehouses.length === 0 && <p className="text-gray-400 italic">{W.empty}</p>}
        </div>
      </div>
    </div>
  )
}
