import { getProducts } from "@/lib/actions/products"
import { ActionForm } from "@/components/ui/action-form"
import { getWarehouses } from "@/lib/actions/warehouses"
import { getCustomers } from "@/lib/actions/customers"
import { createSale, getSales } from "@/lib/actions/sales"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ShoppingBagIcon, PlusIcon, HistoryIcon, CreditCardIcon, LandmarkIcon } from "lucide-react"

export default async function SalesPage() {
  const products = await getProducts()
  const warehouses = await getWarehouses()
  const customers = await getCustomers()
  const sales = await getSales()

  const finishedGoods = products.filter(p => !p.isRawMaterial)

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-gray-900">
          <ShoppingBagIcon className="w-8 h-8 text-emerald-600" />
          Sotuv va Xizmatlar
        </h1>
        <p className="text-gray-500">Tayyor mahsulotlarni sotish va kassa operatsiyalari</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sotuv Formasi */}
        <Card className="lg:col-span-1 shadow-md border-none bg-white">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2 font-black">
              <CreditCardIcon className="w-6 h-6 text-emerald-600" />
              Yangi Savdo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createSale} className="space-y-5">
              <div className="space-y-2 text-black">
                <label className="text-sm font-bold text-gray-700">Mahsulotni tanlang</label>
                <select name="productId" required className="w-full p-3 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-emerald-500 transition-all outline-none">
                  <option value="">Tanlang...</option>
                  {finishedGoods.map(p => <option key={p.id} value={p.id}>{p.name} ({p.price.toLocaleString()} so'm)</option>)}
                </select>
              </div>

              <div className="space-y-2 text-black">
                <label className="text-sm font-bold text-gray-700">Ombor</label>
                <select name="warehouseId" required className="w-full p-3 border rounded-xl bg-gray-50">
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <label className="text-sm font-bold text-gray-700">Miqdor</label>
                   <Input name="quantity" type="number" step="0.01" required className="bg-gray-50 h-11" placeholder="1" />
                 </div>
                 <div className="space-y-2">
                   <label className="text-sm font-bold text-gray-700">Jami summa</label>
                   <Input name="totalAmount" type="number" step="1" required className="bg-gray-50 h-11" placeholder="50000" />
                 </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">To'langan summa</label>
                <Input name="paidAmount" type="number" step="1" required className="bg-gray-50 h-11 text-emerald-600 font-bold" placeholder="50000" />
              </div>

              <div className="space-y-2 text-black">
                <label className="text-sm font-bold text-gray-700">To'lov turi</label>
                <select name="paymentType" required className="w-full p-3 border rounded-xl bg-gray-50">
                  <option value="CASH">Naqd</option>
                  <option value="CARD">Plastik karta</option>
                  <option value="DEBT">Nasiya (Qarz)</option>
                </select>
              </div>

              <div className="space-y-2 text-black">
                <label className="text-sm font-bold text-gray-700">Mijoz (nasiya yoki qisman to'lovda majburiy)</label>
                <select name="customerId" className="w-full p-3 border rounded-xl bg-gray-50">
                  <option value="">Doimiy mijozni tanlang...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                </select>
              </div>

              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold h-12 text-lg text-white">
                Sotuvni yakunlash
              </Button>
            </ActionForm>
          </CardContent>
        </Card>

        {/* Sotuv Tarixi */}
        <Card className="lg:col-span-2 shadow-sm border-none bg-white">
          <CardHeader className="border-b border-gray-50">
            <CardTitle className="text-lg flex items-center gap-2 text-gray-700 font-bold">
              <HistoryIcon className="w-5 h-5 text-gray-400" />
              Oxirgi sotuvlar
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 hover:bg-gray-50/50 border-none text-nowrap">
                  <TableHead className="py-4 px-6 font-bold text-gray-600">Sana</TableHead>
                  <TableHead className="py-4 px-6 font-bold text-gray-600">Mijoz</TableHead>
                  <TableHead className="py-4 px-6 font-bold text-gray-600">Summa</TableHead>
                  <TableHead className="py-4 px-6 font-bold text-gray-600">Tur</TableHead>
                  <TableHead className="py-4 px-6 font-bold text-gray-600 text-right">To'lov</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id} className="hover:bg-gray-50/50 border-b border-gray-100">
                    <TableCell className="py-5 px-6 text-xs text-gray-400 font-medium">
                        {new Date(sale.createdAt).toLocaleString('uz-UZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="py-5 px-6 font-bold text-gray-900">
                       {sale.customer?.name || "Oddiy mijoz"}
                    </TableCell>
                    <TableCell className="py-5 px-6 font-black text-emerald-700">
                       {new Intl.NumberFormat('uz-UZ').format(Number(sale.totalAmount))} so'm
                    </TableCell>
                    <TableCell className="py-5 px-6">
                       <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                          sale.paymentType === 'DEBT' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                          sale.paymentType === 'CARD' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                          'bg-emerald-50 text-emerald-600 border border-emerald-100'
                       }`}>
                          {sale.paymentType}
                       </span>
                    </TableCell>
                    <TableCell className="py-5 px-6 text-right font-medium text-gray-500 italic">
                       {new Intl.NumberFormat('uz-UZ').format(Number(sale.paidAmount))} so'm
                    </TableCell>
                  </TableRow>
                ))}
                {sales.length === 0 && (
                  <TableRow>
                     <TableCell colSpan={5} className="h-48 text-center text-gray-400 italic font-medium">
                       Hali sotuvlar amalga oshirilmagan
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
