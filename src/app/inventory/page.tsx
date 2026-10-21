import { getProducts, createProduct, deleteProduct } from "@/lib/actions/products"
import { getWarehouses } from "@/lib/actions/warehouses"
import { stockIn, stockAdjust } from "@/lib/actions/stock"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DeleteButton } from "@/components/ui/delete-button"
import { Package2Icon, PlusIcon, BoxesIcon, LayersIcon, ArrowDownLeftIcon } from "lucide-react"
import Link from "next/link"

export default async function InventoryPage() {
  const products = await getProducts()
  const warehouses = await getWarehouses()
  const rawMaterials = products.filter(p => p.isRawMaterial)
  const finishedGoods = products.filter(p => !p.isRawMaterial)

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-gray-900">
          <BoxesIcon className="w-8 h-8 text-indigo-600" />
          Katalog va Inventar
        </h1>
        <p className="text-gray-500">Tashkilotning barcha tovar va xomashyolari markazlashgan boshqaruvi</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 items-start">
        {/* Yangi qo'shish */}
        <Card className="xl:col-span-1 shadow-sm border-none bg-white">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <PlusIcon className="w-5 h-5 text-indigo-600" />
              Yangi Toifa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createProduct} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Nomi</label>
                <Input name="name" placeholder="Masalan: Maxsus mato" required className="bg-gray-50 border-gray-100" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Artikul (SKU)</label>
                  <Input name="sku" placeholder="SKU-101" className="bg-gray-50 border-gray-100" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Birlik</label>
                  <Input name="unit" placeholder="dona, kg, metr" defaultValue="dona" className="bg-gray-50 border-gray-100" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Tannarx (so'm)</label>
                  <Input name="costPrice" type="number" step="0.01" className="bg-gray-50 border-gray-100" placeholder="0" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Sotuv narxi (so'm)</label>
                  <Input name="price" type="number" step="0.01" required className="bg-gray-50 border-gray-100" placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Tikuv haqi (1 dona uchun)</label>
                  <Input name="productionWage" type="number" step="0.01" className="bg-gray-100 border-indigo-100" placeholder="5000" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Ogohlantirish limiti</label>
                  <Input name="minStockLevel" type="number" step="0.01" className="bg-gray-50 border-gray-100" placeholder="5" />
                </div>
              </div>
              <div className="flex items-center space-x-2 pt-4">
                <input type="checkbox" id="isRaw" name="isRaw" className="w-5 h-5 accent-indigo-600 rounded border-gray-300" />
                <label htmlFor="isRaw" className="text-sm font-bold text-gray-700 cursor-pointer">Xomashyo</label>
              </div>
              <div className="flex items-start space-x-2 rounded-xl bg-amber-50/60 border border-amber-100 p-3">
                <input type="checkbox" id="isRollTracked" name="isRollTracked" className="w-5 h-5 mt-0.5 accent-amber-600 rounded border-gray-300" />
                <div>
                  <label htmlFor="isRollTracked" className="text-sm font-bold text-gray-700 cursor-pointer">
                    Rulon (bobina) bilan hisoblanadi
                  </label>
                  <p className="text-xs text-gray-500">
                    Faqat xomashyo uchun. Yoqilsa, tikuvda ishchi aniq rulonni tanlashi shart bo'ladi.
                  </p>
                </div>
              </div>
              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold h-11">
                Ro'yxatga qo'shish
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Ro'yxat */}
        <div className="xl:col-span-3">
          <Tabs defaultValue="all" className="w-full">
            <div className="flex justify-between items-center mb-6">
              <TabsList className="bg-gray-100 p-1 rounded-xl">
                <TabsTrigger value="all" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6">Hammasi</TabsTrigger>
                <TabsTrigger value="products" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6">Mahsulotlar</TabsTrigger>
                <TabsTrigger value="raw" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6">Xomashyolar</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="all" className="mt-0">
               <ProductTable products={products} warehouses={warehouses} />
            </TabsContent>
            <TabsContent value="products" className="mt-0">
               <ProductTable products={finishedGoods} warehouses={warehouses} />
            </TabsContent>
            <TabsContent value="raw" className="mt-0">
               <ProductTable products={rawMaterials} warehouses={warehouses} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

function ProductTable({ products, warehouses }: { products: any[], warehouses: any[] }) {
  return (
    <Card className="shadow-sm border-none bg-white overflow-hidden">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50 border-none">
              <TableHead className="py-4 px-6 font-bold text-gray-600">Tovar / SKU</TableHead>
              <TableHead className="py-4 px-6 font-bold text-gray-600">Turi</TableHead>
              <TableHead className="py-4 px-6 font-bold text-gray-600">Umumiy Qoldiq</TableHead>
              <TableHead className="py-4 px-6 font-bold text-gray-600">Tannarx</TableHead>
              <TableHead className="py-4 px-6 font-bold text-gray-600">Sotish narxi</TableHead>
              <TableHead className="py-4 px-6 text-right font-bold text-gray-600">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => {
              const totalQty = p.stockLevels?.reduce((acc: number, sl: any) => acc + sl.quantity, 0) || 0
              return (
                <TableRow key={p.id} className="hover:bg-gray-50/50 border-b border-gray-100">
                  <TableCell className="py-5 px-6">
                    <Link href={`/inventory/${p.id}`} className="flex flex-col group/item text-black">
                      <span className="font-bold text-gray-900 group-hover/item:text-indigo-600 transition-colors uppercase tracking-tight">{p.name}</span>
                      <span className="text-[10px] text-gray-400 font-bold tracking-tight uppercase">{p.sku || "Kodsiz"}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="py-5 px-6">
                    <Badge variant={p.isRawMaterial ? "secondary" : "default"} className={`rounded-md px-2 py-1 ${p.isRawMaterial ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                      {p.isRawMaterial ? <LayersIcon className="w-3 h-3 mr-1" /> : <Package2Icon className="w-3 h-3 mr-1" />}
                      {p.isRawMaterial ? "Xomashyo" : "Mahsulot"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-5 px-6">
                    <div className="flex flex-col gap-1">
                      <span className={`text-lg font-bold ${totalQty > (p.minStockLevel || 0) ? "text-gray-900" : "text-rose-600"}`}>
                        {totalQty} {p.unit}
                        {totalQty <= (p.minStockLevel || 0) && totalQty > 0 && (
                           <span className="ml-2 text-[10px] bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full border border-rose-100">Oz qoldi!</span>
                        )}
                        {totalQty <= 0 && (
                           <span className="ml-2 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full">Tugadi!</span>
                        )}
                      </span>
                      <div className="flex gap-1 flex-wrap">
                        {p.stockLevels?.map((sl: any) => (
                           <span key={sl.id} className="text-[10px] bg-gray-100 px-1 rounded text-gray-500 whitespace-nowrap">
                             {sl.warehouse.name}: {sl.quantity}
                           </span>
                        ))}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 px-6 font-medium text-gray-500 italic">
                    {new Intl.NumberFormat('uz-UZ').format(p.costPrice || 0)}
                  </TableCell>
                  <TableCell className="py-5 px-6 font-bold text-indigo-700">
                    {new Intl.NumberFormat('uz-UZ').format(p.price)}
                  </TableCell>
                  <TableCell className="py-5 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Dialog>
                          <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="h-9 px-3 gap-1 font-bold text-indigo-600 border-indigo-100 hover:bg-indigo-50">
                                <ArrowDownLeftIcon className="w-4 h-4" />
                                Kirim
                              </Button>
                          </DialogTrigger>
                        <DialogContent className="bg-white">
                          <DialogHeader>
                            <DialogTitle className="text-xl font-black">{p.name} — Kirim qilish</DialogTitle>
                          </DialogHeader>
                          <form action={stockIn} className="space-y-4 pt-4">
                            <input type="hidden" name="productId" value={p.id} />
                            <div className="space-y-2 text-black">
                              <label className="text-sm font-bold text-gray-700">Omborni tanlang</label>
                              <select name="warehouseId" required className="w-full p-3 border rounded-xl bg-gray-50">
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                              </select>
                            </div>
                            <div className="space-y-2 text-black">
                              <label className="text-sm font-bold text-gray-700">Miqdor ({p.unit})</label>
                              <Input name="quantity" type="number" step="0.001" required className="bg-gray-50 h-12" />
                            </div>
                            <div className="space-y-2 text-black">
                              <label className="text-sm font-bold text-gray-700">Izoh</label>
                              <Input name="note" placeholder="Masalan: Yangi partiya" className="bg-gray-50 h-12" />
                            </div>
                            <Button type="submit" className="w-full bg-indigo-600 h-12 font-bold text-lg">Tasdiqlash</Button>
                          </form>
                        </DialogContent>
                      </Dialog>

                      {/* Brak Dialog */}
                      <Dialog>
                          <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="h-9 px-3 gap-1 font-bold text-orange-600 border-orange-100 hover:bg-orange-50">
                                <Package2Icon className="w-4 h-4" />
                                Brak
                              </Button>
                          </DialogTrigger>
                        <DialogContent className="bg-white">
                          <DialogHeader>
                            <DialogTitle className="text-xl font-black">{p.name} — Brak qilish</DialogTitle>
                          </DialogHeader>
                          <form action={stockAdjust} className="space-y-4 pt-4">
                            <input type="hidden" name="productId" value={p.id} />
                            <input type="hidden" name="type" value="WASTAGE" />
                            <div className="space-y-2 text-black">
                              <label className="text-sm font-bold text-gray-700">Omborni tanlang</label>
                              <select name="warehouseId" required className="w-full p-3 border rounded-xl bg-gray-50">
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                              </select>
                            </div>
                            <div className="space-y-2 text-black">
                              <label className="text-sm font-bold text-gray-700">Miqdor (Kamayish, e.g. -2)</label>
                              <Input name="quantity" type="number" step="0.001" required className="bg-gray-50 h-12" placeholder="-5" />
                            </div>
                            <div className="space-y-2 text-black">
                              <label className="text-sm font-bold text-red-600">Sababi (MAJBURIY)</label>
                              <Input name="note" placeholder="Masalan: Kuyib ketdi, Sifatsiz" required className="bg-orange-50 border-orange-200 h-12" />
                            </div>
                            <Button type="submit" className="w-full bg-orange-600 h-12 font-bold text-lg text-white">Brakka chiqarish</Button>
                          </form>
                        </DialogContent>
                      </Dialog>

                      {/* Revision Dialog */}
                      <Dialog>
                          <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="h-9 px-3 gap-1 font-bold text-emerald-600 border-emerald-100 hover:bg-emerald-50">
                                <BoxesIcon className="w-4 h-4" />
                                Taftish
                              </Button>
                          </DialogTrigger>
                        <DialogContent className="bg-white">
                          <DialogHeader>
                            <DialogTitle className="text-xl font-black">{p.name} — Taftish (Real qoldiq)</DialogTitle>
                          </DialogHeader>
                          <form action={stockAdjust} className="space-y-4 pt-4">
                            <input type="hidden" name="productId" value={p.id} />
                            <input type="hidden" name="type" value="REVISION" />
                            <div className="space-y-2 text-black">
                              <label className="text-sm font-bold text-gray-700">Ombor</label>
                              <select name="warehouseId" required className="w-full p-3 border rounded-xl bg-gray-50">
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                              </select>
                            </div>
                            <div className="space-y-2 text-black">
                              <label className="text-sm font-bold text-gray-700">Haqiqiy real qoldiq</label>
                              <Input name="quantity" type="number" step="0.001" required className="bg-gray-50 h-12" placeholder="10" />
                            </div>
                            <div className="space-y-2 text-black">
                              <label className="text-sm font-bold text-red-600">Izoh (MAJBURIY)</label>
                              <Input name="note" placeholder="Masalan: Haftalik tahlil" required className="bg-emerald-50 border-emerald-200 h-12" />
                            </div>
                            <Button type="submit" className="w-full bg-emerald-600 h-12 font-bold text-lg text-white">Qoldiqni yangilash</Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                      
                      <DeleteButton
                        action={async () => { 'use server'; await deleteProduct(p.id) }}
                        confirmText={`"${p.name}" mahsulotini o'chirasizmi?`}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center text-gray-400 italic font-medium">
                  Ma'lumotlar topilmadi
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
