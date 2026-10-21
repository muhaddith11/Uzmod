import Link from "next/link"
import { startOfWeek, startOfMonth, startOfYear, format } from "date-fns"
import { CalendarIcon } from "lucide-react"

/**
 * Sana oralig'i filtri — client JS'siz ishlaydi.
 * Preset'lar <Link> (querystring), qo'lda tanlash esa GET forma.
 */
export function DateRangeFilter({
  basePath,
  from,
  to,
}: {
  basePath: string
  from?: string
  to?: string
}) {
  const today = new Date()
  const fmt = (d: Date) => format(d, "yyyy-MM-dd")
  const todayStr = fmt(today)

  const presets = [
    { label: "Bugun", from: todayStr, to: todayStr },
    { label: "Bu hafta", from: fmt(startOfWeek(today, { weekStartsOn: 1 })), to: todayStr },
    { label: "Bu oy", from: fmt(startOfMonth(today)), to: todayStr },
    { label: "Bu yil", from: fmt(startOfYear(today)), to: todayStr },
  ]

  const isAllTime = !from && !to
  const activePreset = presets.find(p => p.from === from && p.to === to)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
      <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-widest">
        <CalendarIcon className="w-4 h-4" /> Davr
      </span>

      <div className="flex flex-wrap gap-1.5">
        <Link
          href={basePath}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            isAllTime ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Hammasi
        </Link>
        {presets.map(p => {
          const active = activePreset?.label === p.label
          return (
            <Link
              key={p.label}
              href={`${basePath}?from=${p.from}&to=${p.to}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                active ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {p.label}
            </Link>
          )
        })}
      </div>

      <form method="get" action={basePath} className="flex items-center gap-2 ml-auto">
        <input
          type="date"
          name="from"
          defaultValue={from ?? ""}
          className="text-xs font-medium border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 text-black"
        />
        <span className="text-gray-300">—</span>
        <input
          type="date"
          name="to"
          defaultValue={to ?? ""}
          className="text-xs font-medium border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 text-black"
        />
        <button
          type="submit"
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-800 text-white hover:bg-gray-900 transition-colors"
        >
          Ko'rish
        </button>
      </form>
    </div>
  )
}
