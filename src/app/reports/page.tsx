import { getFinancialSummary } from "@/lib/actions/reports"
import { DateRangeFilter } from "@/components/DateRangeFilter"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import {
  DollarSignIcon,
  TrendingUpIcon,
  WalletIcon,
  ArrowUpRightIcon,
  ArrowDownRightIcon,
  CreditCardIcon,
  ShoppingBagIcon,
  BoxIcon
} from "lucide-react"

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { from, to } = await searchParams
  const data = await getFinancialSummary({ from, to })

  const formattedRevenue = new Intl.NumberFormat('uz-UZ').format(data.totalRevenue)
  const formattedNetProfit = new Intl.NumberFormat('uz-UZ').format(data.netProfit)
  const formattedExpenses = new Intl.NumberFormat('uz-UZ').format(data.totalExpenses)
  const formattedDebt = new Intl.NumberFormat('uz-UZ').format(data.totalDebt)
  const formattedInventory = new Intl.NumberFormat('uz-UZ').format(data.inventoryValue)

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10 bg-gray-50/50 min-h-screen">
      <div className="space-y-1">
        <h1 className="text-4xl font-black text-gray-900 tracking-tight">Moliyaviy Hisobot</h1>
        <p className="text-gray-500 font-medium">Biznesingizning jami foyda va zararlar tahlili.</p>
      </div>

      <DateRangeFilter basePath="/reports" from={from} to={to} />

      {/* Primary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-[2rem] border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-8 space-y-2">
            <div className="flex justify-between items-start">
              <div className="bg-blue-50 text-blue-600 p-3 rounded-2xl">
                <DollarSignIcon className="w-5 h-5" />
              </div>
              <div className="flex items-center text-green-500 text-xs font-bold bg-green-50 px-2 py-1 rounded-full">
                <ArrowUpRightIcon className="w-3 h-3 " />
                Total
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Jami Savdo</p>
              <h3 className="text-3xl font-black text-gray-900">{formattedRevenue} s.</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-sm bg-indigo-600 text-white overflow-hidden">
          <CardContent className="p-8 space-y-2">
            <div className="flex justify-between items-start">
              <div className="bg-indigo-500 text-white p-3 rounded-2xl">
                <TrendingUpIcon className="w-5 h-5" />
              </div>
              <div className="text-white/80 text-xs font-bold">SOF FOYDA</div>
            </div>
            <div>
              <p className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Xarajatlardan keyin</p>
              <h3 className="text-3xl font-black">{formattedNetProfit} s.</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-8 space-y-2">
            <div className="flex justify-between items-start">
              <div className="bg-red-50 text-red-600 p-3 rounded-2xl">
                <WalletIcon className="w-5 h-5" />
              </div>
              <div className="flex items-center text-red-500 text-xs font-bold bg-red-50 px-2 py-1 rounded-full">
                <ArrowDownRightIcon className="w-3 h-3 " />
                Exp
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Jami Xarajatlar</p>
              <h3 className="text-3xl font-black text-gray-900">{formattedExpenses} s.</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-8 space-y-2">
            <div className="flex justify-between items-start">
              <div className="bg-orange-50 text-orange-600 p-3 rounded-2xl">
                <CreditCardIcon className="w-5 h-5" />
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Kutilayotgan Qarzlar</p>
              <h3 className="text-3xl font-black text-gray-900">{formattedDebt} s.</h3>
              <p className="text-[10px] text-gray-400 font-medium mt-1">Hozirgi holat (davrga bog'liq emas)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <Card className="lg:col-span-2 rounded-[2.5rem] border-none shadow-sm bg-white p-8">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-2xl font-black">Moliyaviy Taqsimot</CardTitle>
            <CardDescription>Daromad, Tannarx va Foyda nisbati</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pt-6">
            <div className="space-y-6">
               <div className="space-y-2">
                 <div className="flex justify-between text-sm font-bold">
                   <span className="text-gray-500 uppercase tracking-widest">Yalpi foyda (Markup)</span>
                   <span className="text-indigo-600">{Math.round((data.grossProfit / (data.totalRevenue || 1)) * 100)}%</span>
                 </div>
                 <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden">
                   <div 
                    className="bg-indigo-600 h-full transition-all" 
                    style={{ width: `${(data.grossProfit / (data.totalRevenue || 1)) * 100}%` }} 
                   />
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Sotuvlar soni</p>
                    <p className="text-2xl font-black text-gray-900">{data.salesCount}</p>
                 </div>
                 <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Tannarx (COGS)</p>
                    <p className="text-2xl font-black text-gray-900">{new Intl.NumberFormat('uz-UZ').format(data.totalCOGS)} s.</p>
                 </div>
               </div>
            </div>
          </CardContent>
        </Card>

        {/* Inventory Value */}
        <Card className="rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden flex flex-col">
          <CardHeader className="p-8 pb-0">
            <CardTitle className="text-2xl font-black flex items-center gap-2">
              <BoxIcon className="w-6 h-6 text-emerald-600" />
              Ombor Bahosi
            </CardTitle>
            <CardDescription>Barcha tovarlar jami tannarxi</CardDescription>
          </CardHeader>
          <CardContent className="p-8 flex-1 flex flex-col justify-center items-center text-center">
             <div className="w-32 h-32 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
               <ShoppingBagIcon className="w-12 h-12 text-emerald-600" />
             </div>
             <h4 className="text-4xl font-black text-gray-900 mb-2">{formattedInventory} s.</h4>
             <p className="text-sm font-medium text-gray-400 max-w-[200px]">
               Hozirda omborda mavjud bo'lgan barcha boyliklaringiz qiymati.
             </p>
          </CardContent>
        </Card>

      </div>

      {/* Expenses Breakdown */}
      <Card className="rounded-[2.5rem] border-none shadow-sm bg-white p-8">
        <CardHeader className="px-0 pt-0 mb-6">
          <CardTitle className="text-2xl font-black">Xarajatlar Kategoriyasi</CardTitle>
          <CardDescription>Bilvosita xarajatlar qayerga ketayotganini ko'ring</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.expenseChart.map((ex, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="font-bold text-gray-600">{ex.name}</span>
                <span className="font-black text-gray-900">{new Intl.NumberFormat('uz-UZ').format(ex.value)} s.</span>
              </div>
            ))}
            {data.expenseChart.length === 0 && (
              <p className="col-span-full h-24 flex items-center justify-center text-gray-400 italic">Hali xarajatlar kiritilmagan</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
