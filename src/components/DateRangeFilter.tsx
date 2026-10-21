import Link from "next/link"
import { CalendarIcon } from "lucide-react"
import { getT } from "@/i18n/server"
import { addDays, startOfTashkentDayFor, tashkentDateKey } from "@/lib/tz"

/**
 * Sana oralig'i filtri — client JS'siz ishlaydi. Kunlar Toshkent vaqtida.
 * Preset'lar <Link> (querystring), qo'lda tanlash esa GET forma.
 */
export async function DateRangeFilter({
  basePath,
  from,
  to,
  allowAllTime = true,
}: {
  basePath: string
  from?: string
  to?: string
  allowAllTime?: boolean
}) {
  const t = await getT()
  const now = new Date()
  const today = tashkentDateKey(now)
  const todayStart = startOfTashkentDayFor(now)

  const presets = [
    { label: t.common.today, from: today, to: today },
    { label: t.common.last7, from: tashkentDateKey(addDays(todayStart, -6)), to: today },
    { label: t.common.last30, from: tashkentDateKey(addDays(todayStart, -29)), to: today },
    { label: t.common.thisMonth, from: `${today.slice(0, 8)}01`, to: today },
  ]

  const isAllTime = !from && !to
  const activePreset = presets.find(p => p.from === from && p.to === to)
  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
      active ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
    }`

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
      <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-widest">
        <CalendarIcon className="w-4 h-4" />
      </span>

      <div className="flex flex-wrap gap-1.5">
        {allowAllTime && (
          <Link href={basePath} className={chip(isAllTime)}>{t.common.allTime}</Link>
        )}
        {presets.map(p => (
          <Link key={p.label} href={`${basePath}?from=${p.from}&to=${p.to}`} className={chip(activePreset?.label === p.label)}>
            {p.label}
          </Link>
        ))}
      </div>

      <form method="get" action={basePath} className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <input
          type="date"
          name="from"
          aria-label={t.common.from}
          defaultValue={from ?? ""}
          className="text-xs font-medium border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 text-black"
        />
        <span className="text-gray-300">—</span>
        <input
          type="date"
          name="to"
          aria-label={t.common.to}
          defaultValue={to ?? ""}
          className="text-xs font-medium border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 text-black"
        />
        <button
          type="submit"
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-800 text-white hover:bg-gray-900 transition-colors"
        >
          {t.common.apply}
        </button>
      </form>
    </div>
  )
}
