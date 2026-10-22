'use client'

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { useLocale, useT } from "@/i18n/client"
import { formatNumber } from "@/lib/format"
import { colorHex, pairsFromKg } from "@/lib/domain/machines"

const PRESETS = [20, 25, 30]

/** Ombordagi har bir ipdan necha juft paypoq chiqishi — bir nechta gramm bo'yicha */
export function YarnCalculator({ yarns }: { yarns: { id: string; name: string; color: string; stockKg: number }[] }) {
  const t = useT()
  const locale = useLocale()
  const Y = t.yarn
  const [custom, setCustom] = useState("")
  const customGram = parseFloat(custom)
  const grams = [...PRESETS, ...(customGram > 0 && !PRESETS.includes(customGram) ? [customGram] : [])]
  const totalKg = yarns.reduce((acc, y) => acc + Math.max(y.stockKg, 0), 0)
  const fmt = (n: number) => formatNumber(n, locale, 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-xs text-gray-500 max-w-md">{Y.calcHint}</p>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          {Y.customGram}
          <Input
            type="number" min="1" max="500" step="0.5" inputMode="decimal"
            value={custom}
            onChange={e => setCustom(e.target.value)}
            className="h-9 w-24 bg-white"
            placeholder="22"
          />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="py-2 pr-3 font-bold">{t.machines.yarn}</th>
              <th className="py-2 px-3 font-bold text-right">kg</th>
              {grams.map(g => <th key={g} className="py-2 px-3 font-bold text-right whitespace-nowrap">{g} g</th>)}
            </tr>
          </thead>
          <tbody>
            {yarns.map(y => (
              <tr key={y.id} className="border-b border-gray-50">
                <td className="py-2 pr-3">
                  <span className="inline-flex items-center gap-2 font-semibold text-gray-900">
                    <span className="w-3 h-3 rounded-full border border-gray-300 shrink-0" style={{ background: colorHex(y.color) }} />
                    {y.name}
                  </span>
                </td>
                <td className="py-2 px-3 text-right font-mono">{formatNumber(y.stockKg, locale)}</td>
                {grams.map(g => (
                  <td key={g} className="py-2 px-3 text-right font-mono">{Y.pairs(fmt(pairsFromKg(Math.max(y.stockKg, 0), g)))}</td>
                ))}
              </tr>
            ))}
            <tr className="font-black text-gray-900">
              <td className="py-2 pr-3">{Y.total}</td>
              <td className="py-2 px-3 text-right font-mono">{formatNumber(totalKg, locale)}</td>
              {grams.map(g => <td key={g} className="py-2 px-3 text-right font-mono">{Y.pairs(fmt(pairsFromKg(totalKg, g)))}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
