import { getCustomers, createCustomer, deleteCustomer, repayDebt } from "@/lib/actions/customers"
import { ActionForm } from "@/components/ui/action-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DeleteButton } from "@/components/ui/delete-button"
import { UsersIcon, PlusIcon, PhoneIcon, BanknoteIcon, HandCoinsIcon } from "lucide-react"

export default async function CustomersPage() {
  const customers = await getCustomers()

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-gray-900">
          <UsersIcon className="w-8 h-8 text-blue-600" />
          Mijozlar va Nasiyalar
        </h1>
        <p className="text-gray-500">Doimiy mijozlar ro'yxati va ularning qarzdorlik hisobi</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Yangi mijoz */}
        <Card className="lg:col-span-1 shadow-sm border-none bg-white h-fit">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PlusIcon className="w-5 h-5 text-blue-600" />
              Yangi mijoz
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createCustomer} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">F.I.O</label>
                <Input name="name" placeholder="Masalan: Aziz Rahimov" required className="bg-gray-50 border-gray-100 h-11" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Telefon</label>
                <Input name="phone" placeholder="+998 90 123 45 67" className="bg-gray-50 border-gray-100 h-11" />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 font-bold h-11 text-white">
                Mijozni qo'shish
              </Button>
            </ActionForm>
          </CardContent>
        </Card>

        {/* Mijozlar ro'yxati */}
        <Card className="lg:col-span-3 shadow-sm border-none bg-white overflow-hidden">
          <CardHeader className="border-b border-gray-50">
            <CardTitle className="text-lg flex items-center gap-2 font-bold text-gray-700">
              Barcha mijozlar
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 border-none hover:bg-gray-50/50">
                  <TableHead className="py-4 px-6 font-bold text-gray-600">Mijoz ismi</TableHead>
                  <TableHead className="py-4 px-6 font-bold text-gray-600">Telefon</TableHead>
                  <TableHead className="py-4 px-6 font-bold text-gray-600 text-right">Mavjud qarz</TableHead>
                  <TableHead className="py-4 px-6 text-right font-bold text-gray-600">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id} className="hover:bg-gray-50/50 border-b border-gray-100">
                    <TableCell className="py-5 px-6 font-bold text-gray-900">
                       {c.name}
                    </TableCell>
                    <TableCell className="py-5 px-6 text-gray-500 font-medium">
                       <div className="flex items-center gap-1">
                          <PhoneIcon className="w-3 h-3 text-gray-400" />
                          {c.phone || "Kiritilmagan"}
                       </div>
                    </TableCell>
                    <TableCell className="py-5 px-6 text-right font-black text-rose-600">
                       <div className="flex items-center justify-end gap-1">
                          <BanknoteIcon className="w-4 h-4 text-rose-400" />
                          {new Intl.NumberFormat('uz-UZ').format(Number(c.debt))} so'm
                       </div>
                    </TableCell>
                    <TableCell className="py-5 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {Number(c.debt) > 0 && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              >
                                <HandCoinsIcon className="w-4 h-4 mr-1" />
                                Qarzni to'lash
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>{c.name} — qarz to'lovi</DialogTitle>
                              </DialogHeader>
                              <ActionForm action={repayDebt} className="space-y-4 pt-4">
                                <input type="hidden" name="customerId" value={c.id} />
                                <div className="rounded-xl bg-rose-50 p-4 text-sm">
                                  <span className="text-gray-600">Mavjud qarz: </span>
                                  <span className="font-black text-rose-600">
                                    {new Intl.NumberFormat('uz-UZ').format(Number(c.debt))} so'm
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-gray-700">To'lov summasi</label>
                                  <Input
                                    name="amount"
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max={Number(c.debt)}
                                    required
                                    placeholder="0.00"
                                    className="bg-gray-50 border-gray-100 h-11"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-bold text-gray-700">Izoh (ixtiyoriy)</label>
                                  <Input
                                    name="note"
                                    placeholder="Masalan: naqd pul olindi"
                                    className="bg-gray-50 border-gray-100 h-11"
                                  />
                                </div>
                                <Button
                                  type="submit"
                                  className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold h-11 text-white"
                                >
                                  To'lovni tasdiqlash
                                </Button>
                              </ActionForm>
                            </DialogContent>
                          </Dialog>
                        )}
                        <DeleteButton
                          action={async () => { 'use server'; return deleteCustomer(c.id) }}
                          confirmText={`"${c.name}" mijozini o'chirasizmi?`}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {customers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-48 text-center text-gray-400 italic">
                      Mijozlar topilmadi
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
