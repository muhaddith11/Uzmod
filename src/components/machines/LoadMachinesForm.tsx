'use client'

import { useState } from "react"
import { loadMachines } from "@/lib/actions/machines"
import { ActionForm } from "@/components/ui/action-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, NativeSelect, inputClass } from "@/components/ui/field"
import { useLocale, useT } from "@/i18n/client"
import { formatNumber } from "@/lib/format"
import { parseMachineNumbers, socksFromKg } from "@/lib/domain/machines"

export type LoadFormOptions = {
  yarns: { id: string; name: string; color: string | null; stockKg: number }[]
  workers: { id: string; name: string }[]
  canChooseWorker: boolean
}

const GRAM_PRESETS = [20, 25, 30]

/** Bir yoki bir nechta stanokka ip qo'yish (chiqadigan paypoq soni jonli ko'rinadi) */
export function LoadMachinesForm({
  options,
  machineNumbers = "",
  lockNumbers = false,
  onSuccess,
}: {
  options: LoadFormOptions
  machineNumbers?: string
  lockNumbers?: boolean
  onSuccess?: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const M = t.machines
  const [numbers, setNumbers] = useState(machineNumbers)
  const [yarnId, setYarnId] = useState("")
  const [gram, setGram] = useState("")
  const [kg, setKg] = useState("")
  const [loadedCount, setLoadedCount] = useState(0)

  if (options.yarns.length === 0) return <p className="text-sm text-gray-500">{M.noYarnStock}</p>

  const count = parseMachineNumbers(numbers)?.length ?? 0
  const gramNum = parseFloat(gram)
  const kgNum = parseFloat(kg)
  const perMachine = gramNum > 0 && kgNum > 0 ? socksFromKg(kgNum, gramNum) : null
  const yarn = options.yarns.find(y => y.id === yarnId)
  const totalKg = kgNum > 0 ? kgNum * Math.max(count, 1) : 0
  const fmt = (n: number) => formatNumber(n, locale)

  return (
    // Ip, gramm va kg keyingi stanoklar uchun qoladi — faqat raqamlar tozalanadi
    <ActionForm
      action={loadMachines}
      onSuccess={() => {
        setLoadedCount(count)
        setNumbers(machineNumbers)
        onSuccess?.()
      }}
      successMessage={lockNumbers ? undefined : M.loaded(loadedCount)}
      className="space-y-4"
    >
      <Field label={M.machineNumbers} hint={lockNumbers ? undefined : M.machineNumbersHint}>
        <Input
          name="machines" required readOnly={lockNumbers}
          value={numbers} onChange={e => setNumbers(e.target.value)}
          placeholder={M.machineNumbersPlaceholder}
          className={`${inputClass} ${lockNumbers ? "bg-gray-100 font-bold" : ""}`}
        />
      </Field>
      <Field label={M.yarn}>
        <NativeSelect name="yarnId" required value={yarnId} onChange={e => setYarnId(e.target.value)}>
          <option value="" disabled>{t.common.select}</option>
          {options.yarns.map(y => <option key={y.id} value={y.id}>{y.name} · {fmt(y.stockKg)} kg</option>)}
        </NativeSelect>
      </Field>
      <Field label={M.gramsPerSock}>
        <div className="flex gap-2">
          {GRAM_PRESETS.map(g => (
            <button
              key={g} type="button" onClick={() => setGram(String(g))}
              className={`h-11 px-3 rounded-xl border text-sm font-bold shrink-0 ${gramNum === g ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200"}`}
            >
              {g} g
            </button>
          ))}
          <Input
            name="gramsPerSock" type="number" step="0.5" min="1" max="500" required inputMode="decimal"
            value={gram} onChange={e => setGram(e.target.value)}
            className={inputClass} placeholder="g"
          />
        </div>
      </Field>
      <Field label={M.kgPerMachine}>
        <Input
          name="kgPerMachine" type="number" step="0.01" min="0" required inputMode="decimal"
          value={kg} onChange={e => setKg(e.target.value)}
          className={inputClass}
        />
      </Field>
      {options.canChooseWorker && (
        <Field label={M.worker}>
          <NativeSelect name="workerId" defaultValue="">
            <option value="">{t.common.none}</option>
            {options.workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </NativeSelect>
        </Field>
      )}

      {perMachine !== null && (
        <div className={`rounded-xl p-3 text-sm space-y-0.5 ${yarn && totalKg > yarn.stockKg ? "bg-rose-50 text-rose-900" : "bg-indigo-50 text-indigo-900"}`}>
          <p><b>{M.expected}:</b> {t.yarn.socks(fmt(perMachine))} — {M.perMachineLabel}</p>
          {count > 1 && <p><b>{t.common.total}:</b> {fmt(totalKg)} kg → {t.yarn.socks(fmt(perMachine * count))}</p>}
          {yarn && totalKg > yarn.stockKg && <p className="font-bold">{t.stockSales.available(fmt(yarn.stockKg))}</p>}
        </div>
      )}

      <Button type="submit" className="w-full h-12 bg-green-600 hover:bg-green-700 text-white text-base font-bold">
        {M.load}{count > 1 ? ` (${count})` : ""}
      </Button>
    </ActionForm>
  )
}
