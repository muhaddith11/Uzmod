import { auth } from "@/auth"
import { getDashboardData } from "@/lib/actions/dashboard"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import ProductionChart from "@/components/dashboard/ProductionChart"
import { 
  Package2Icon, 
  WarehouseIcon, 
  TrendingUpIcon, 
  TrendingDownIcon, 
  AlertTriangleIcon,
  BarChart3Icon,
  ShoppingBagIcon,
  CalendarIcon
} from "lucide-react"

export default async function HomePage() {
  const session = await auth()
  const data = await getDashboardData()

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-gray-50/50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Xayrli kun, {session?.user?.name?.split(' ')[0]}!</h1>
          <p className="text-gray-500 font-medium">Mana bugungi sex ko'rsatkichlari va ombor holati.</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl shadow-sm border border-gray-100 italic text-sm text-gray-400">
          <CalendarIcon className="w-4 h-4" />
          Oxirgi 7 kun
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Chart and Critical Stock */}
        <div className="lg:col-span-2 space-y-8">
          {/* Chart */}
          <Card className="rounded-[2.5rem] border-none shadow-sm bg-white p-6">
            <CardHeader className="flex flex-row items-center justify-between pb-8">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-black flex items-center gap-2">
                  <BarChart3Icon className="w-6 h-6 text-indigo-600" />
                  Ishlab chiqarish
                </CardTitle>
                <CardDescription>Oxirgi haftalik mahsulot chiqishi</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ProductionChart data={data.chartData} />
            </CardContent>
          </Card>

          {/* Critical Stock */}
          <Card className="rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="p-8 pb-4">
               <CardTitle className="text-2xl font-black flex items-center gap-2 text-red-600">
                 <AlertTriangleIcon className="w-6 h-6" />
                 Kritik Qoldiq
               </CardTitle>
               <CardDescription>Zudlik bilan to'ldirilishi kerak bo'lgan xomashyolar</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
               <Table>
                 <TableHeader>
                   <TableRow className="bg-gray-50/50 border-none">
                     <TableHead className="px-8 py-4 font-bold text-gray-400">Xomashyo</TableHead>
                     <TableHead className="px-8 py-4 font-bold text-gray-400">Birlik</TableHead>
                     <TableHead className="px-8 py-4 font-bold text-gray-400">Hozirgi qoldiq</TableHead>
                     <TableHead className="px-8 py-4 font-bold text-gray-400">Holat</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {data.criticalStock.map((item, i) => (
                     <TableRow key={i} className="border-b border-gray-50 hover:bg-red-50/30 transition-colors">
                       <TableCell className="px-8 py-4 font-bold text-gray-900">{item.name}</TableCell>
                       <TableCell className="px-8 py-4 text-gray-500 font-medium">{item.unit}</TableCell>
                       <TableCell className="px-8 py-4">
                         <span className="text-lg font-black text-red-500">{item.total}</span>
                       </TableCell>
                       <TableCell className="px-8 py-4">
                         <Badge variant="destructive" className="bg-red-100 text-red-600 border-none px-3">Kam qolgan!</Badge>
                       </TableCell>
                     </TableRow>
                   ))}
                   {data.criticalStock.length === 0 && (
                     <TableRow>
                       <TableCell colSpan={4} className="h-48 text-center text-gray-400 italic font-medium">
                         Barcha xomashyolar yetarli
                       </TableCell>
                     </TableRow>
                   )}
                 </TableBody>
               </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Top Products and Other Stats */}
        <div className="space-y-8">
           {/* Top Products */}
           <Card className="rounded-[2.5rem] border-none shadow-sm bg-indigo-600 text-white p-8">
             <CardHeader className="px-0 pt-0">
               <CardTitle className="text-2xl font-black flex items-center gap-2">
                 <ShoppingBagIcon className="w-6 h-6" />
                 Top Sotilganlar
               </CardTitle>
               <CardDescription className="text-indigo-200">Eng xaridorgir mahsulotlar</CardDescription>
             </CardHeader>
             <CardContent className="px-0 pt-6 space-y-6">
               {data.topProducts.map((p, i) => (
                 <div key={i} className="space-y-2">
                   <div className="flex justify-between items-end font-bold">
                     <span className="text-lg tracking-tight uppercase">{p.name}</span>
                     <span className="text-2xl">{p.total} dona</span>
                   </div>
                   <Progress value={(p.total / (data.topProducts[0]?.total || 1)) * 100} className="h-2 bg-indigo-400" />
                 </div>
               ))}
               {data.topProducts.length === 0 && (
                 <div className="h-32 flex items-center justify-center text-indigo-300 font-medium italic">
                   Sotuvlar tarixi mavjud emas
                 </div>
               )}
             </CardContent>
           </Card>

           {/* Small Stats */}
           <div className="grid grid-cols-1 gap-6">
             <div className="bg-white p-8 rounded-[2rem] shadow-sm flex items-center justify-between group hover:shadow-lg transition-all cursor-default">
               <div className="space-y-1">
                 <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Aktiv omborlar</p>
                 <p className="text-4xl font-black text-gray-900">{data.warehouseCount}</p>
               </div>
               <div className="bg-indigo-50 text-indigo-600 p-4 rounded-2xl group-hover:scale-110 transition-transform">
                 <WarehouseIcon className="w-6 h-6" />
               </div>
             </div>
             
             <div className="bg-white p-8 rounded-[2rem] shadow-sm flex items-center justify-between group hover:shadow-lg transition-all cursor-default">
               <div className="space-y-1">
                 <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">O'rtacha quvvat</p>
                 <p className="text-4xl font-black text-gray-900">82%</p>
               </div>
               <div className="bg-green-50 text-green-600 p-4 rounded-2xl group-hover:scale-110 transition-transform">
                 <TrendingUpIcon className="w-6 h-6" />
               </div>
             </div>
           </div>
        </div>

      </div>
    </div>
  )
}
