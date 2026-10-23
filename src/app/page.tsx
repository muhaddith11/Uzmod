import { getDashboardData } from "@/lib/actions/dashboard"
import { getSessionUser, isManagement } from "@/lib/session"
import { getEnabledModules } from "@/lib/modules"
import { getMyMonthSummary, getTodayBoard } from "@/lib/actions/attendance"
import { formatDuration } from "@/lib/domain/attendance"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import ProductionChart from "@/components/dashboard/ProductionChart"
import { getLocale, getT } from "@/i18n/server"
import { formatMoney, formatNumber } from "@/lib/format"
import { BarChart3Icon, CalendarIcon, BanknoteIcon, UsersIcon, CogIcon, PackageOpenIcon, PackageCheckIcon } from "lucide-react"

export default async function HomePage() {
  const me = await getSessionUser()
  // Davomat ishchi va menejerlarga yuritiladi (admin — egasi)
  const tracked = me.role !== 'ADMIN'
  const [modules, data, t, locale, myMonth, board] = await Promise.all([
    getEnabledModules(),
    getDashboardData(), getT(), getLocale(),
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
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl ring-1 ring-gray-200/80 text-sm text-gray-500 w-fit">
          <CalendarIcon className="w-4 h-4" />
          {D.last7days}
        </div>
      </div>

      {myMonth && (
        <div className="bg-white rounded-2xl ring-1 ring-gray-200/80 p-5 space-y-3">
          <p className="text-sm font-bold text-gray-700">{A.myMonth}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat label={A.colHours} value={formatDuration(myMonth.workedMinutes)} />
            <MiniStat label={A.colPresent} value={`${myMonth.presentDays} / ${myMonth.workingDays}`} />
            <MiniStat label={A.colLateCount} value={String(myMonth.lateCount)} warn={myMonth.lateCount > 0} />
            <MiniStat label={A.colAbsent} value={String(myMonth.absentDays)} warn={myMonth.absentDays > 0} />
          </div>
        </div>
      )}

      {isManagement(me.role) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StockTile href="/stock" label={D.stockYarn} kg={formatNumber(data.yarnKg, locale)} tone="teal" />
          <StockTile href="/stock" label={D.stockFinished} kg={formatNumber(data.finishedKg, locale)} tone="indigo" />
          <StockTile href="/stock" label={D.stockDefect} kg={formatNumber(data.defectKg, locale)} tone="rose" />
          <StockTile href="/stock" label={D.stockWaste} kg={formatNumber(data.wasteKg, locale)} tone="stone" />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {board && (
          <Stat icon={<UsersIcon className="w-5 h-5" />} label={D.atWorkToday} value={`${board.counts.inWork} / ${board.counts.total}`} tone="green" />
        )}
        {data.machines > 0 && (
          <Stat icon={<CogIcon className="w-5 h-5" />} label={D.runningMachines} value={`${data.runningMachines} / ${data.machines}`} tone="indigo" />
        )}
        <Stat
          icon={<PackageCheckIcon className="w-5 h-5" />}
          label={D.producedTodayKg}
          value={`${formatNumber(data.producedTodayKg, locale)} kg`}
          sub={t.stock.approxSocks(formatNumber(data.producedTodaySocks, locale))}
          tone="indigo"
        />
        {isManagement(me.role) && (
          <Stat icon={<PackageOpenIcon className="w-5 h-5" />} label={D.yarnToday} value={`${formatNumber(data.yarnTodayKg, locale)} kg`} tone="amber" />
        )}
        {data.salesToday !== null && modules.has("sales") && (
          <Stat icon={<BanknoteIcon className="w-5 h-5" />} label={D.salesToday} value={formatMoney(data.salesToday, locale)} tone="green" />
        )}
        {data.knittingKg > 0 && (
          <Stat icon={<CogIcon className="w-5 h-5" />} label={D.knittingNow} value={`${formatNumber(data.knittingKg, locale)} kg`} tone="gray" />
        )}
      </div>

      <Card className="p-4 md:p-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-black flex items-center gap-2">
            <BarChart3Icon className="w-6 h-6 text-indigo-600" />
            {D.productionTitle}
          </CardTitle>
          <CardDescription>{D.producedChart}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProductionChart data={data.chartData} label="kg" />
        </CardContent>
      </Card>
    </div>
  )
}

const STOCK_TONES = {
  teal: "bg-teal-50 ring-teal-100 text-teal-900 hover:bg-teal-100/60",
  indigo: "bg-indigo-50 ring-indigo-100 text-indigo-900 hover:bg-indigo-100/60",
  rose: "bg-rose-50 ring-rose-100 text-rose-900 hover:bg-rose-100/60",
  stone: "bg-stone-100 ring-stone-200 text-stone-900 hover:bg-stone-200/60",
} as const

function StockTile({ href, label, kg, tone }: { href: string; label: string; kg: string; tone: keyof typeof STOCK_TONES }) {
  return (
    <Link href={href} className={`rounded-2xl ring-1 p-5 transition-colors ${STOCK_TONES[tone]}`}>
      <p className="text-sm font-bold opacity-80">{label}</p>
      <p className="text-2xl md:text-3xl font-black mt-1 tabular-nums">{kg} <span className="text-lg font-bold opacity-60">kg</span></p>
    </Link>
  )
}

const TONES = {
  indigo: "bg-indigo-50 text-indigo-600",
  green: "bg-green-50 text-green-600",
  amber: "bg-amber-50 text-amber-600",
  gray: "bg-gray-100 text-gray-600",
} as const

function Stat({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone: keyof typeof TONES }) {
  return (
    <div className="bg-white p-5 rounded-2xl ring-1 ring-gray-200/80 flex items-center justify-between gap-3">
      <div className="space-y-1 min-w-0">
        <p className="text-sm font-semibold text-gray-500">{label}</p>
        <p className="text-xl md:text-2xl font-black text-gray-900 truncate">{value}</p>
        {sub && <p className="text-xs font-semibold text-gray-500 truncate">{sub}</p>}
      </div>
      <div className={`p-3 rounded-xl shrink-0 ${TONES[tone]}`}>{icon}</div>
    </div>
  )
}

function MiniStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className={`text-xl font-black ${warn ? "text-rose-600" : "text-gray-900"}`}>{value}</p>
    </div>
  )
}
