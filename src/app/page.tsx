import { getDashboardData } from "@/lib/actions/dashboard"
import { getSessionUser, isManagement } from "@/lib/session"
import { getEnabledModules } from "@/lib/modules"
import { getMyAttendanceToday, getMyMonthSummary, getTodayBoard } from "@/lib/actions/attendance"
import { CheckInCard } from "@/components/attendance/CheckInCard"
import { formatDuration } from "@/lib/domain/attendance"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import ProductionChart from "@/components/dashboard/ProductionChart"
import { getLocale, getT } from "@/i18n/server"
import { formatMoney, formatNumber } from "@/lib/format"
import {
  WarehouseIcon, AlertTriangleIcon, BarChart3Icon, ShoppingBagIcon, CalendarIcon, HammerIcon, DiscIcon, BanknoteIcon, UsersIcon, CogIcon, PackageOpenIcon
} from "lucide-react"

export default async function HomePage() {
  const me = await getSessionUser()
  // Davomat ishchi va menejerlarga yuritiladi (admin — egasi)
  const tracked = me.role !== 'ADMIN'
  const [modules, data, t, locale, myToday, myMonth, board] = await Promise.all([
    getEnabledModules(),
    getDashboardData(), getT(), getLocale(),
    tracked ? getMyAttendanceToday() : Promise.resolve(null),
    tracked ? getMyMonthSummary() : Promise.resolve(null),
    isManagement(me.role) ? getTodayBoard() : Promise.resolve(null),
  ])
  const D = t.dashboard
  const A = t.attendance
  const firstName = me.name?.split(' ')[0] ?? ""

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">{D.greeting(firstName)}</h1>
          <p className="text-gray-500 font-medium">{D.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl shadow-sm border border-gray-100 text-sm text-gray-400 w-fit">
          <CalendarIcon className="w-4 h-4" />
          {D.last7days}
        </div>
      </div>

      {myToday && myMonth && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <CheckInCard initial={myToday} />
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-5 space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{A.myMonth}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MiniStat label={A.colHours} value={formatDuration(myMonth.workedMinutes)} />
              <MiniStat label={A.colPresent} value={`${myMonth.presentDays} / ${myMonth.workingDays}`} />
              <MiniStat label={A.colLateCount} value={String(myMonth.lateCount)} warn={myMonth.lateCount > 0} />
              <MiniStat label={A.colAbsent} value={String(myMonth.absentDays)} warn={myMonth.absentDays > 0} />
            </div>
          </div>
        </div>
      )}

      <div className={`grid grid-cols-2 gap-4 ${board ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        {board && (
          <Stat icon={<UsersIcon className="w-5 h-5" />} label={D.atWorkToday} value={`${board.counts.inWork} / ${board.counts.total}`} tone="green" />
        )}
        <Stat icon={<HammerIcon className="w-5 h-5" />} label={D.producedToday} value={formatNumber(data.producedToday, locale)} tone="indigo" />
        {data.salesToday !== null && modules.has("sales") && (
          <Stat icon={<BanknoteIcon className="w-5 h-5" />} label={D.salesToday} value={formatMoney(data.salesToday, locale)} tone="green" />
        )}
        {data.machines > 0 && (
          <Stat icon={<CogIcon className="w-5 h-5" />} label={D.runningMachines} value={`${data.runningMachines} / ${data.machines}`} tone="indigo" />
        )}
        {isManagement(me.role) && (
          <Stat icon={<PackageOpenIcon className="w-5 h-5" />} label={D.yarnToday} value={`${formatNumber(data.yarnTodayKg, locale)} kg`} tone="amber" />
        )}
        {modules.has("rolls") && (
          <Stat icon={<DiscIcon className="w-5 h-5" />} label={D.openRolls} value={formatNumber(data.openRolls, locale)} tone="amber" />
        )}
        {!board && <Stat icon={<WarehouseIcon className="w-5 h-5" />} label={D.warehouses} value={formatNumber(data.warehouseCount, locale)} tone="gray" />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="rounded-3xl border-none shadow-sm bg-white p-4 md:p-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-black flex items-center gap-2">
                <BarChart3Icon className="w-6 h-6 text-indigo-600" />
                {D.productionTitle}
              </CardTitle>
              <CardDescription>{D.productionSubtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <ProductionChart data={data.chartData} label={t.common.quantity} />
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="p-6 md:p-8 pb-4">
               <CardTitle className="text-2xl font-black flex items-center gap-2 text-red-600">
                 <AlertTriangleIcon className="w-6 h-6" />
                 {D.criticalTitle}
               </CardTitle>
               <CardDescription>{D.criticalSubtitle}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
               <Table>
                 <TableHeader>
                   <TableRow className="bg-gray-50/50 border-none">
                     <TableHead className="px-6 md:px-8 py-4 font-bold text-gray-400">{D.colMaterial}</TableHead>
                     <TableHead className="px-6 md:px-8 py-4 font-bold text-gray-400">{D.colCurrent}</TableHead>
                     <TableHead className="px-6 md:px-8 py-4 font-bold text-gray-400">{D.colLimit}</TableHead>
                     <TableHead className="px-6 md:px-8 py-4 font-bold text-gray-400">{t.common.status}</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {data.criticalStock.map(item => (
                     <TableRow key={item.name} className="border-b border-gray-50 hover:bg-red-50/30 transition-colors">
                       <TableCell className="px-6 md:px-8 py-4 font-bold text-gray-900">{item.name}</TableCell>
                       <TableCell className="px-6 md:px-8 py-4">
                         <span className="text-lg font-black text-red-500">{formatNumber(item.total, locale)}</span>{" "}
                         <span className="text-gray-500">{item.unit}</span>
                       </TableCell>
                       <TableCell className="px-6 md:px-8 py-4 text-gray-500">{formatNumber(item.minLevel, locale)}</TableCell>
                       <TableCell className="px-6 md:px-8 py-4">
                         <Badge variant="destructive" className="bg-red-100 text-red-600 border-none px-3">{D.low}</Badge>
                       </TableCell>
                     </TableRow>
                   ))}
                   {data.criticalStock.length === 0 && (
                     <TableRow>
                       <TableCell colSpan={4} className="h-32 text-center text-gray-400 italic font-medium">{D.allEnough}</TableCell>
                     </TableRow>
                   )}
                 </TableBody>
               </Table>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-3xl border-none shadow-sm bg-indigo-600 text-white p-6 md:p-8 h-fit">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-2xl font-black flex items-center gap-2">
              <ShoppingBagIcon className="w-6 h-6" />
              {D.topTitle}
            </CardTitle>
            <CardDescription className="text-indigo-200">{D.topSubtitle}</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pt-6 space-y-6">
            {data.topProducts.map(p => (
              <div key={p.name} className="space-y-2">
                <div className="flex justify-between items-end gap-3 font-bold">
                  <span className="tracking-tight truncate">{p.name}</span>
                  <span className="text-xl shrink-0">{formatNumber(p.total, locale)} {p.unit}</span>
                </div>
                <Progress value={(p.total / (data.topProducts[0]?.total || 1)) * 100} className="h-2 bg-indigo-400" />
              </div>
            ))}
            {data.topProducts.length === 0 && (
              <div className="h-32 flex items-center justify-center text-indigo-200 font-medium italic">{D.noSales}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const TONES = {
  indigo: "bg-indigo-50 text-indigo-600",
  green: "bg-green-50 text-green-600",
  amber: "bg-amber-50 text-amber-600",
  gray: "bg-gray-100 text-gray-600",
} as const

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: keyof typeof TONES }) {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm flex items-center justify-between gap-3">
      <div className="space-y-1 min-w-0">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        <p className="text-xl md:text-2xl font-black text-gray-900 truncate">{value}</p>
      </div>
      <div className={`p-3 rounded-xl shrink-0 ${TONES[tone]}`}>{icon}</div>
    </div>
  )
}

function MiniStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-black ${warn ? "text-rose-600" : "text-gray-900"}`}>{value}</p>
    </div>
  )
}
