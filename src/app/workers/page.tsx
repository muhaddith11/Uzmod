import { getWorkers, getStaff, createEmployee, addAdjustment, deleteAdjustment } from "@/lib/actions/workers"
import { ActionForm } from "@/components/ui/action-form"
import { getSessionUser } from "@/lib/session"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DeleteButton } from "@/components/ui/delete-button"
import { UserIcon, BanknoteIcon, TrendingUpIcon, TrendingDownIcon, PlusIcon, UserPlusIcon } from "lucide-react"

const ROLE_LABELS: Record<string, string> = { ADMIN: 'Admin', MANAGER: 'Menejer', WORKER: 'Ishchi' }

export default async function WorkersPage() {
  const me = await getSessionUser()
  const workers = await getWorkers()
  const staff = await getStaff()

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-gray-900">
          <UserIcon className="w-8 h-8 text-indigo-600" />
          Xodimlar va Ishbay haq
        </h1>
        <p className="text-gray-500">Tikuvchilarning bajargan ishlari va balansini boshqarish</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-8">
        {/* Yangi xodim */}
        <Card className="shadow-sm border-none bg-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlusIcon className="w-5 h-5 text-indigo-600" />
              Yangi xodim
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ActionForm
              action={createEmployee}
              successMessage="Xodim qo'shildi. Endi u email va parol bilan kira oladi."
              className="space-y-4"
            >
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Ism-sharif</label>
                <Input name="name" placeholder="Masalan: Anvar Tikuvchi" required className="bg-gray-50 h-11" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Email (login)</label>
                <Input name="email" type="email" placeholder="ishchi@example.com" required className="bg-gray-50 h-11" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Parol</label>
                <Input name="password" type="text" minLength={6} placeholder="Kamida 6 ta belgi" required className="bg-gray-50 h-11" />
              </div>
              <div className="space-y-2 text-black">
                <label className="text-sm font-bold text-gray-700">Lavozim</label>
                <select name="role" required className="w-full p-3 border rounded-xl bg-gray-50">
                  <option value="WORKER">Ishchi (Tikuvchi)</option>
                  {me.role === 'ADMIN' && <option value="MANAGER">Menejer</option>}
                </select>
              </div>
              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold h-11">
                Xodim qo'shish
              </Button>
            </ActionForm>
            <div className="space-y-2 border-t border-gray-100 pt-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Jamoa ({staff.length})</p>
              {staff.map(s => (
                <div key={s.id} className="flex justify-between items-center gap-2 text-sm">
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-gray-800 truncate">{s.name ?? s.email}</span>
                    <span className="text-[10px] text-gray-400 truncate">{s.email}</span>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <Badge variant="outline">{ROLE_LABELS[s.role] ?? s.role}</Badge>
                    <span className={`text-[10px] ${s.telegramId ? "text-green-600" : "text-gray-400"}`}>
                      {s.telegramId ? "Telegram ulangan" : "Telegram yo'q"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bonus/Jarima formasi */}
        <Card className="shadow-sm border-none bg-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PlusIcon className="w-5 h-5 text-indigo-600" />
              Bonus yoki Jarima
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={addAdjustment} className="space-y-4">
              <div className="space-y-2 text-black">
                <label className="text-sm font-bold text-gray-700">Xodim</label>
                <select name="userId" required className="w-full p-3 border rounded-xl bg-gray-50">
                   <option value="">Xodimni tanlang...</option>
                   {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Summa</label>
                <Input name="amount" type="number" placeholder="50000" required className="bg-gray-50 h-11" />
              </div>
              <div className="space-y-2 text-black">
                <label className="text-sm font-bold text-gray-700">Turi</label>
                <select name="type" required className="w-full p-3 border rounded-xl bg-gray-50">
                  <option value="BONUS">Bonus (Mukofot)</option>
                  <option value="PENALTY">Jarima (Chiqim)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Izoh</label>
                <Input name="note" placeholder="Sababi..." className="bg-gray-50 h-11" />
              </div>
              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold h-11">
                Tasdiqlash
              </Button>
            </ActionForm>
          </CardContent>
        </Card>
        </div>

        {/* Xodimlar ro'yxati */}
        <div className="lg:col-span-3 space-y-6">
           {workers.map((worker) => {
              // Tikuvdan tushgan jami pul
              const productionEarnings = (worker as any).movements?.reduce((acc: number, m: any) => {
                 return acc + (m.quantity * Number(m.product.productionWage || 0))
              }, 0) || 0

              // Bonus/Jarimalar jami
              const adjustmentTotal = (worker as any).adjustments?.reduce((acc: number, a: any) => acc + Number(a.amount), 0) || 0
              
              const totalBalance = productionEarnings + adjustmentTotal

              return (
                <Card key={worker.id} className="shadow-sm border-none bg-white overflow-hidden">
                   <div className="p-6 bg-gray-50/50 border-b flex justify-between items-center">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                            <UserIcon className="w-6 h-6" />
                         </div>
                         <div>
                            <h3 className="text-xl font-black text-gray-900">{worker.name}</h3>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">{worker.email}</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Jami hisob</p>
                         <p className={`text-2xl font-black ${totalBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {new Intl.NumberFormat('uz-UZ').format(totalBalance)} so'm
                         </p>
                      </div>
                   </div>
                   <CardContent className="p-0">
                      <div className="grid grid-cols-1 md:grid-cols-2">
                         {/* Ishlar tarixi */}
                         <div className="p-6 border-r border-gray-100">
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                               <TrendingUpIcon className="w-4 h-4 text-green-500" /> Bajargan ishlari (Ishbay)
                            </h4>
                            <div className="space-y-3">
                               {(worker as any).movements?.map((m: any) => (
                                  <div key={m.id} className="flex justify-between items-center text-sm">
                                     <span className="text-gray-600 font-medium">{m.product.name} ({m.quantity} dona)</span>
                                     <span className="font-bold text-gray-900">
                                        {new Intl.NumberFormat('uz-UZ').format(m.quantity * Number(m.product.productionWage))} s.
                                     </span>
                                  </div>
                               ))}
                               {(worker as any).movements?.length === 0 && (
                                  <p className="text-xs text-gray-400 italic">Hali ish kiritilmagan</p>
                               )}
                            </div>
                         </div>
                         {/* Bonuslar tarixi */}
                         <div className="p-6">
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                               <BanknoteIcon className="w-4 h-4 text-blue-500" /> Qo'shimcha (Bonus/Jarima)
                            </h4>
                            <div className="space-y-3">
                               {(worker as any).adjustments?.map((a: any) => (
                                  <div key={a.id} className="flex justify-between items-center text-sm">
                                     <div className="flex flex-col">
                                        <span className="text-gray-600 font-medium">{a.note || a.type}</span>
                                        <span className="text-[10px] text-gray-400">{new Date(a.createdAt).toLocaleDateString()}</span>
                                     </div>
                                     <div className="flex items-center gap-2">
                                        <span className={`font-bold ${Number(a.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>
                                           {Number(a.amount) > 0 ? "+" : ""}{new Intl.NumberFormat('uz-UZ').format(Number(a.amount))} s.
                                        </span>
                                        <DeleteButton
                                          action={async () => { 'use server'; return deleteAdjustment(a.id) }}
                                          confirmText="Bu tartibni o'chirasizmi?"
                                          className="h-6 w-6 text-gray-300 hover:text-red-500"
                                          iconClassName="w-3 h-3"
                                        />
                                     </div>
                                  </div>
                               ))}
                               {(worker as any).adjustments?.length === 0 && (
                                  <p className="text-xs text-gray-400 italic">O'zgarishlar yo'q</p>
                               )}
                            </div>
                         </div>
                      </div>
                   </CardContent>
                </Card>
              )
           })}
        </div>
      </div>
    </div>
  )
}
