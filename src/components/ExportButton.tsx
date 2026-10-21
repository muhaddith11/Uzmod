import { FileSpreadsheetIcon } from "lucide-react"
import { getT } from "@/i18n/server"

/** Excel yuklab olish havolasi (route handler fayl qaytaradi) */
export async function ExportButton({ kind, from, to }: { kind: string; from?: string; to?: string }) {
  const t = await getT()
  const params = new URLSearchParams()
  if (from) params.set("from", from)
  if (to) params.set("to", to)
  const query = params.toString()

  return (
    <a
      href={`/api/export/${kind}${query ? `?${query}` : ""}`}
      className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-bold hover:bg-emerald-100 transition-colors"
    >
      <FileSpreadsheetIcon className="w-4 h-4" />
      {t.common.exportExcel}
    </a>
  )
}
