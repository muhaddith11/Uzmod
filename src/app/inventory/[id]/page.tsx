import { prisma } from "@/lib/prisma"
import { getProducts } from "@/lib/actions/products"
import { addBOMItem, deleteBOMItem } from "@/lib/actions/bom"
import { auth } from "@/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DeleteButton } from "@/components/ui/delete-button"
import { Package2Icon, PlusIcon, Settings2Icon, ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

export default async function ProductDetailsPage({ params }: { params: { id: string } }) {
  const session = await auth()
  const orgId = (session?.user as any).organizationId
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id, organizationId: orgId },
    include: {
      bomItems: { include: { material: true } }
    }
  })

  if (!product) redirect("/inventory")

  const allProducts = await prisma.product.findMany({
    where: { organizationId: orgId, id: { not: id } }
  })

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <Link href="/inventory" className="text-gray-500 hover:text-indigo-600 flex items-center gap-1 font-medium transition-colors">
        <ArrowLeftIcon className="w-4 h-4" /> Orqaga qaytish
      </Link>

      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">{product.name}</h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">SKU: {product.sku || "—"}</p>
        </div>
        <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl font-bold border border-indigo-100">
           {product.isRawMaterial ? "Xomashyo" : "Tayyor Mahsulot"}
        </div>
      </div>

      {!product.isRawMaterial && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1 shadow-sm border-none bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusIcon className="w-5 h-5 text-indigo-600" />
                Reseptga qo'shish
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={addBOMItem} className="space-y-4">
                <input type="hidden" name="productId" value={product.id} />
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Tarkibiy qism (Xomashyo)</label>
                  <select name="materialId" required className="w-full p-3 border rounded-xl bg-gray-50 text-black">
                    <option value="">Tanlang...</option>
                    {allProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Miqdor (1 birlik uchun)</label>
                  <Input name="quantityNeeded" type="number" step="0.001" required className="bg-gray-50 h-12" placeholder="0.5" />
                </div>
                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold h-11">
                  Qabul qilish
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 shadow-sm border-none bg-white overflow-hidden">
            <CardHeader className="bg-gray-50/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2Icon className="w-5 h-5 text-gray-400" />
                Resept Tarkibi (BOM)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50 hover:bg-gray-50/50 border-none">
                    <TableHead className="py-4 px-6 font-bold">Ingredient</TableHead>
                    <TableHead className="py-4 px-6 font-bold">Miqdor</TableHead>
                    <TableHead className="py-4 px-6 text-right font-bold text-gray-400">O'chirish</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.bomItems.map((item) => (
                    <TableRow key={item.id} className="border-b border-gray-50">
                      <TableCell className="py-4 px-6 font-bold text-gray-900">{item.material.name}</TableCell>
                      <TableCell className="py-4 px-6 font-black text-indigo-600">{item.quantityNeeded} {item.material.unit}</TableCell>
                      <TableCell className="py-4 px-6 text-right">
                        <DeleteButton
                          action={async () => { 'use server'; await deleteBOMItem(item.id) }}
                          confirmText={`"${item.material.name}" reseptdan o'chirasizmi?`}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {product.bomItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="h-48 text-center text-gray-400 italic">
                        Resept hali kiritilmagan
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
