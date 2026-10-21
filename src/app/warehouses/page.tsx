import { getWarehouses, createWarehouse, deleteWarehouse } from "@/lib/actions/warehouses"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DeleteButton } from "@/components/ui/delete-button"
import { WarehouseIcon, PlusIcon, MapPinIcon } from "lucide-react"

export default async function WarehousesPage() {
  const warehouses = await getWarehouses()

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <WarehouseIcon className="w-8 h-8 text-blue-600" />
          Omborlar Boshqaruvi
        </h1>
        <p className="text-gray-500">Tashkilotingizdagi barcha jismoniy omborlar va sexlar ro'yxati</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="md:col-span-1 shadow-sm border-none bg-white">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <PlusIcon className="w-5 h-5" />
              Yangi Ombor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createWarehouse} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Ombor nomi</label>
                <Input name="name" placeholder="Masalan: Asosiy ombor" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Manzil (ixtiyoriy)</label>
                <Input name="address" placeholder="Toshkent sh., Yunusobod..." />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                Saqlash
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-sm border-none bg-white">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="py-4 px-6 font-bold">Ombor nomi</TableHead>
                  <TableHead className="py-4 px-6 font-bold">Manzil</TableHead>
                  <TableHead className="py-4 px-6 text-right font-bold">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.map((warehouse) => (
                  <TableRow key={warehouse.id} className="hover:bg-gray-50/50">
                    <TableCell className="py-4 px-6 font-medium text-gray-900">{warehouse.name}</TableCell>
                    <TableCell className="py-4 px-6 text-gray-500">
                      <div className="flex items-center gap-1">
                        <MapPinIcon className="w-4 h-4" />
                        {warehouse.address || "Belgilanmagan"}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-6 text-right">
                      <DeleteButton
                        action={async () => { 'use server'; await deleteWarehouse(warehouse.id) }}
                        confirmText={`"${warehouse.name}" omborini o'chirasizmi?`}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {warehouses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="h-32 text-center text-gray-400 italic">
                      Hali omborlar qo'shilmagan
                    </TableCell>
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
