import { getProducts } from "@/lib/actions/products"
import { ActionForm } from "@/components/ui/action-form"
import { getWarehouses } from "@/lib/actions/warehouses"
import { getRolls, createRolls, finishRoll } from "@/lib/actions/rolls"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { DeleteButton } from "@/components/ui/delete-button"
import { DiscIcon, PlusIcon } from "lucide-react"

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  AVAILABLE: { label: "Ochilmagan", className: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  IN_USE: { label: "Ishlatilmoqda", className: "bg-amber-50 text-amber-700 border-amber-100" },
  FINISHED: { label: "Tugagan", className: "bg-gray-100 text-gray-500 border-gray-200" },
}

export default async function RollsPage() {
  const [products, warehouses, rolls] = await Promise.all([
    getProducts(),
    getWarehouses(),
    getRolls(),
  ])

  const rollMaterials = products.filter(p => p.isRawMaterial && p.isRollTracked)

  const totalWeight = rolls.reduce((acc, r) => acc + r.currentWeight, 0)

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-gray-900">
          <DiscIcon className="w-8 h-8 text-amber-600" />
          Rulonlar
        </h1>
        <p className="text-gray-500">
          Ip va mato rulonlarini partiya bilan qabul qilish va qoldiqlarini kuzatish
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Partiya qabul qilish */}
        <Card className="lg:col-span-1 shadow-sm border-none bg-white h-fit">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PlusIcon className="w-5 h-5 text-amber-600" />
              Partiya qabul qilish
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rollMaterials.length === 0 ? (
              <p className="text-sm text-gray-500">
                Hali rulon bilan hisoblanadigan xomashyo yo'q. Inventar sahifasida xomashyo
                qo'shayotganda &laquo;Rulon bilan hisoblanadi&raquo; belgisini yoqing.
              </p>
            ) : (
              <ActionForm action={createRolls} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Xomashyo</label>
                  <select
                    name="productId"
                    required
                    className="w-full p-3 border rounded-xl bg-gray-50 text-black"
                  >
                    <option value="">Tanlang...</option>
                    {rollMaterials.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Ombor</label>
                  <select
                    name="warehouseId"
                    required
                    className="w-full p-3 border rounded-xl bg-gray-50 text-black"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Rulon vaznlari</label>
                  <Input
                    name="weights"
                    required
                    placeholder="25.4, 26.1, 24.8"
                    className="bg-gray-50 border-gray-100 h-11"
                  />
                  <p className="text-xs text-gray-500">
                    Har bir rulon vaznini vergul bilan ajrating. Nechta son kiritsangiz,
                    shuncha rulon yaratiladi.
                  </p>
                </div>

                <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 font-bold h-11 text-white">
                  Qabul qilish
                </Button>
              </ActionForm>
            )}
          </CardContent>
        </Card>

        {/* Rulonlar ro'yxati */}
        <Card className="lg:col-span-3 shadow-sm border-none bg-white overflow-hidden">
          <CardHeader className="border-b border-gray-50 flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold text-gray-700">
              Ochiq rulonlar
            </CardTitle>
            <div className="text-right">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Jami qoldiq</p>
              <p className="text-xl font-black text-amber-600">
                {new Intl.NumberFormat('uz-UZ').format(totalWeight)} kg
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 border-none hover:bg-gray-50/50">
                  <TableHead className="py-4 px-6 font-bold text-gray-600">Xomashyo</TableHead>
                  <TableHead className="py-4 px-6 font-bold text-gray-600">Ombor</TableHead>
                  <TableHead className="py-4 px-6 font-bold text-gray-600">Holat</TableHead>
                  <TableHead className="py-4 px-6 font-bold text-gray-600 w-64">Qoldiq</TableHead>
                  <TableHead className="py-4 px-6 font-bold text-gray-600 text-right">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rolls.map((r) => {
                  const status = STATUS_LABELS[r.status] ?? STATUS_LABELS.AVAILABLE
                  const percent = r.initialWeight > 0
                    ? Math.round((r.currentWeight / r.initialWeight) * 100)
                    : 0

                  return (
                    <TableRow key={r.id} className="hover:bg-gray-50/50 border-b border-gray-100">
                      <TableCell className="py-5 px-6 font-bold text-gray-900">
                        {r.product.name}
                      </TableCell>
                      <TableCell className="py-5 px-6 text-gray-500 font-medium">
                        {r.warehouse.name}
                      </TableCell>
                      <TableCell className="py-5 px-6">
                        <Badge variant="outline" className={`rounded-md px-2 py-1 ${status.className}`}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5 px-6">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-gray-900">
                              {r.currentWeight} {r.product.unit}
                            </span>
                            <span className="text-gray-400">
                              / {r.initialWeight} {r.product.unit}
                            </span>
                          </div>
                          <Progress value={percent} className="h-2" />
                        </div>
                      </TableCell>
                      <TableCell className="py-5 px-6 text-right">
                        <DeleteButton
                          action={async () => { 'use server'; return finishRoll(r.id) }}
                          confirmText={`Bu rulonni yopasizmi? Qolgan ${r.currentWeight} ${r.product.unit} brak sifatida hisobdan chiqadi.`}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
                {rolls.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center text-gray-400 italic">
                      Ochiq rulon yo'q
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
