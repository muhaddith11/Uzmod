import { FileTextIcon } from "lucide-react"
import { getT } from "@/i18n/server"

/** Word (.docx) hisobotni yuklab olish havolasi — route handler faylni qaytaradi */
export async function ExportButton({ kind, from, to, label }: { kind: string; from?: string; to?: string; label?: string }) {
  const t = await getT()
  const params = new URLSearchParams()
  if (from) params.set("from", from)
  if (to) params.set("to", to)
  const query = params.toString()

  return (
    <a
      href={`/api/export/${kind}${query ? `?${query}` : ""}`}
      download
      className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-semibold shadow-[0_1px_2px_0_rgb(16_24_40/0.05)] hover:bg-gray-50 hover:border-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-indigo-500/30"
    >
      <FileTextIcon className="w-4 h-4 text-blue-600" />
      {label ?? t.common.exportWord}
    </a>
  )
}
