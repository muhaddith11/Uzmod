import { getExpenses, createExpense, deleteExpense } from "@/lib/actions/expenses"
import { ActionForm } from "@/components/ui/action-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DeleteButton } from "@/components/ui/delete-button"
import { WalletIcon, PlusIcon, ReceiptIcon, TrendingDownIcon } from "lucide-react"

export default async function FinancePage() {
  const expenses = await getExpenses()
  const totalExpenses = expenses.reduce((acc, exp) => acc + Number(exp.amount), 0)

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-gray-900">
          <WalletIcon className="w-8 h-8 text-rose-600" />
          Moliya va Xarajatlar
        </h1>
        <p className="text-gray-500">Kunlik yashirin va bilvosita xarajatlarni boshqarish</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         <Card className="bg-rose-50 border-rose-100 shadow-sm">
            <CardContent className="pt-6">
               <div className="flex items-center justify-between">
                  <div>
                     <p className="text-sm font-bold text-rose-600 uppercase tracking-wider">Jami xarajatlar</p>
                     <h3 className="text-2xl font-black text-rose-900 mt-1">
                        {new Intl.NumberFormat('uz-UZ').format(totalExpenses)} so'm
                     </h3>
                  </div>
                  <TrendingDownIcon className="w-10 h-10 text-rose-200" />
               </div>
            </CardContent>
         </Card>

         <Card className="bg-orange-50 border-orange-100 shadow-sm">
            <CardContent className="pt-6">
               <div className="flex items-center justify-between">
                  <div>
                     <p className="text-sm font-bold text-orange-600 uppercase tracking-wider">Oshxona xarajatlari</p>
                     <h3 className="text-2xl font-black text-orange-900 mt-1">
                        {new Intl.NumberFormat('uz-UZ').format(expenses.filter(e => e.category === 'Oshxona').reduce((acc, e) => acc + Number(e.amount), 0))} so'm
                     </h3>
                  </div>
                  <PlusIcon className="w-10 h-10 text-orange-200" />
               </div>
            </CardContent>
         </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Yangi xarajat */}
        <Card className="lg:col-span-1 shadow-sm border-none bg-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PlusIcon className="w-5 h-5 text-rose-600" />
              Yangi xarajat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createExpense} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Miqdori (so'm)</label>
                <Input name="amount" type="number" placeholder="50000" required className="bg-gray-50 border-gray-100 h-11" />
              </div>
              <div className="space-y-2 text-black">
                <label className="text-sm font-bold text-gray-700">Kategoriya</label>
                <select name="category" required className="w-full p-3 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-rose-500 transition-all outline-none">
                  <option value="">Tanlang...</option>
                  <option value="Oshxona">Oshxona (Oziq-ovqat)</option>
                  <option value="Ijara">Ijara</option>
                  <option value="Elektr">Elektr</option>
                  <option value="Suv">Suv</option>
                  <option value="Reklama">Reklama</option>
                  <option value="Paket/Salfetka">Paket/Salfetka</option>
                  <option value="Transport">Transport</option>
                  <option value="Boshqa">Boshqa</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Izoh</label>
                <Input name="note" placeholder="Masalan: Mart oyi uchun ijara" className="bg-gray-50 border-gray-100 h-11" />
              </div>
              <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 font-bold h-11 text-white">
                Saqlash
              </Button>
            </ActionForm>
          </CardContent>
        </Card>

        {/* Xarajatlar ro'yxati */}
        <Card className="lg:col-span-3 shadow-sm border-none bg-white">
          <CardHeader className="border-b border-gray-50">
            <CardTitle className="text-lg flex items-center gap-2">
              <ReceiptIcon className="w-5 h-5 text-gray-400" />
              Xarajatlar tarixi
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 hover:bg-gray-50/50 border-none">
                  <TableHead className="py-4 px-6 font-bold text-gray-600">Sana</TableHead>
                  <TableHead className="py-4 px-6 font-bold text-gray-600">Kategoriya</TableHead>
                  <TableHead className="py-4 px-6 font-bold text-gray-600">Summa</TableHead>
                  <TableHead className="py-4 px-6 font-bold text-gray-600">Izoh</TableHead>
                  <TableHead className="py-4 px-6 text-right font-bold text-gray-600">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((exp) => (
                  <TableRow key={exp.id} className="hover:bg-gray-50/50 border-b border-gray-100">
                    <TableCell className="py-5 px-6 text-sm text-gray-500 font-medium">
                        {new Date(exp.createdAt).toLocaleDateString('uz-UZ')}
                    </TableCell>
                    <TableCell className="py-5 px-6">
                       <span className="bg-rose-50 text-rose-700 px-3 py-1 rounded-full text-xs font-bold border border-rose-100">
                          {exp.category}
                       </span>
                    </TableCell>
                    <TableCell className="py-5 px-6 font-black text-gray-900">
                       {new Intl.NumberFormat('uz-UZ').format(Number(exp.amount))} so'm
                    </TableCell>
                    <TableCell className="py-5 px-6 text-sm text-gray-600 italic">
                       {exp.note || "-"}
                    </TableCell>
                    <TableCell className="py-5 px-6 text-right">
                      <DeleteButton
                        action={async () => { 'use server'; return deleteExpense(exp.id) }}
                        confirmText="Bu xarajatni o'chirasizmi?"
                        className="text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {expenses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center text-gray-400 italic">
                      Hali xarajatlar kiritilmadi
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
