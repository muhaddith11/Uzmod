'use client'

import { useState, useTransition } from "react"
import { receiveYarn } from "@/lib/actions/yarn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, inputClass } from "@/components/ui/field"
import { useLocale, useT } from "@/i18n/client"
import { formatNumber } from "@/lib/format"
import { AlertTriangleIcon, CheckCircle2Icon, PlusIcon, Trash2Icon } from "lucide-react"

type Line = { key: number; type: string; color: string; kg: string }

let nextKey = 1
const emptyLine = (type = "", color = ""): Line => ({ key: nextKey++, type, color, kg: "" })

export function YarnReceiveForm({ types, colors }: { types: string[]; colors: string[] }) {
  const t = useT()
  const locale = useLocale()
  const Y = t.yarn
  const [lines, setLines] = useState<Line[]>(() => [emptyLine()])
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  const totalKg = lines.reduce((acc, l) => acc + (parseFloat(l.kg) > 0 ? parseFloat(l.kg) : 0), 0)
  const update = (key: number, patch: Partial<Line>) =>
    setLines(prev => prev.map(l => (l.key === key ? { ...l, ...patch } : l)))

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set("lines", JSON.stringify(
      lines
        .filter(l => l.type.trim() || l.color.trim() || l.kg)
        .map(l => ({ type: l.type, color: l.color, kg: l.kg }))
    ))
    setError(null)
    setDone(false)
    startTransition(async () => {
      const result = await receiveYarn(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      setLines([emptyLine()])
      setDone(true)
    })
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
      <datalist id="yarn-types">{types.map(v => <option key={v} value={v} />)}</datalist>
      <datalist id="yarn-colors">{colors.map(v => <option key={v} value={v} />)}</datalist>

      <div className="space-y-3">
        {lines.map((line, index) => (
          <div key={line.key} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input
                aria-label={`${Y.type} ${index + 1}`}
                list="yarn-types"
                placeholder={Y.typePlaceholder}
                value={line.type}
                onChange={e => update(line.key, { type: e.target.value })}
                className={`${inputClass} bg-white`}
              />
              <Input
                aria-label={`${Y.color} ${index + 1}`}
                list="yarn-colors"
                placeholder={Y.colorPlaceholder}
                value={line.color}
                onChange={e => update(line.key, { color: e.target.value })}
                className={`${inputClass} bg-white`}
              />
            </div>
            <div className="flex gap-2">
              <Input
                aria-label={Y.kg}
                type="number" step="0.01" min="0" inputMode="decimal"
                placeholder={Y.kg}
                value={line.kg}
                onChange={e => update(line.key, { kg: e.target.value })}
                className={`${inputClass} bg-white`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 text-gray-400 hover:text-rose-600 shrink-0"
                onClick={() => setLines(prev => (prev.length > 1 ? prev.filter(l => l.key !== line.key) : [emptyLine()]))}
                title={Y.removeLine}
                aria-label={Y.removeLine}
              >
                <Trash2Icon className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="w-full h-10 gap-1 border-dashed"
          onClick={() => setLines(prev => [...prev, emptyLine(prev[prev.length - 1]?.type ?? "")])}
        >
          <PlusIcon className="w-4 h-4" /> {Y.addLine}
        </Button>
      </div>

      <Field label={t.common.note}>
        <Input name="note" placeholder={t.common.notePlaceholder} className={inputClass} />
      </Field>

      <div className="rounded-xl bg-teal-50 p-4 flex justify-between items-center">
        <span className="text-sm font-bold text-teal-900">{Y.total}</span>
        <span className="text-2xl font-black text-teal-700">{formatNumber(totalKg, locale)} kg</span>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 font-medium flex items-start gap-2">
          <AlertTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}
      {done && !error && (
        <div role="status" className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-700 font-medium flex items-start gap-2">
          <CheckCircle2Icon className="w-4 h-4 mt-0.5 shrink-0" /><span>{Y.received}</span>
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full bg-teal-600 hover:bg-teal-700 h-12 text-lg font-bold text-white">
        {Y.submit}
      </Button>
    </form>
  )
}
