import { getProducts } from "@/lib/actions/products"
import { getWarehouses } from "@/lib/actions/warehouses"
import { getProductionLogs } from "@/lib/actions/production"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getWorkers } from "@/lib/actions/workers"
import { ProductionForm } from "@/components/production/ProductionForm"
import { HammerIcon, HistoryIcon, ArrowRightIcon } from "lucide-react"

export default async function ProductionPage() {
  const products = await getProducts()
  const warehouses = await getWarehouses()
  const workers = await getWorkers()
  const logs = await getProductionLogs()

  const finishedGoods = products.filter(p => !p.isRawMaterial)

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-gray-900">
          <HammerIcon className="w-8 h-8 text-purple-600" />
          Ishlab chiqarish Moduli
        </h1>
        <p className="text-gray-500">Tayyor mahsulot ishlab chiqarish va avtomatik xomashyo sarfi</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form */}
        <Card className="lg:col-span-1 shadow-md border-none bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightIcon className="w-5 h-5 text-purple-600" />
              Yangi Buyruq
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProductionForm
              finishedGoods={finishedGoods.map(p => ({ id: p.id, name: p.name }))}
              warehouses={warehouses.map(w => ({ id: w.id, name: w.name }))}
              workers={workers.map(w => ({ id: w.id, name: w.name ?? "Nomsiz" }))}
            />
          </CardContent>
        </Card>

        {/* Tarix */}
        <Card className="lg:col-span-2 shadow-sm border-none bg-white">
          <CardHeader className="border-b border-gray-50 pb-6">
            <CardTitle className="flex items-center gap-2">
              <HistoryIcon className="w-5 h-5 text-gray-400" />
              Oxirgi ishlab chiqarishlar
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-none">
                  <TableHead className="py-4 px-6 font-bold text-gray-600">Sana</TableHead>
                  <TableHead className="py-4 px-6 font-bold text-gray-600">Mahsulot</TableHead>
                  <TableHead className="py-4 px-6 font-bold text-gray-600">Miqdor</TableHead>
                  <TableHead className="py-4 px-6 font-bold text-gray-600">Ombor</TableHead>
                  <TableHead className="py-4 px-6 font-bold text-gray-600">Ishchi</TableHead>
                  <TableHead className="py-4 px-6 font-bold text-gray-600">Izoh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 border-b border-gray-50">
                    <td className="py-4 px-6 text-sm text-gray-500 font-medium">
                      {new Date(log.createdAt).toLocaleString('uz-UZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-4 px-6 font-bold text-gray-900">{log.product.name}</td>
                    <td className="py-4 px-6 text-purple-600 font-extrabold">+{log.quantity} dona</td>
                     <td className="py-4 px-6">
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600 font-bold text-nowrap">
                          {log.toWarehouse?.name}
                        </span>
                     </td>
                     <td className="py-4 px-6">
                        <span className="text-xs bg-indigo-50 px-2 py-1 rounded-full text-indigo-700 font-bold">
                          {(log as any).worker?.name || "—"}
                        </span>
                     </td>
                     <td className="py-4 px-6 text-sm text-gray-500 italic">
                       {log.note}
                     </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="h-48 text-center text-gray-400 italic">
                      Hali hech narsa ishlab chiqarilmadi
                    </td>
                  </tr>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
