'use client'

import { useState } from "react"
import type { StockSaleKind } from "@prisma/client"
import { createStockSale } from "@/lib/actions/stock-sales"
import { ActionForm } from "@/components/ui/action-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, NativeSelect, inputClass } from "@/components/ui/field"
import { useLocale, useT } from "@/i18n/client"
import { formatMoney, formatNumber } from "@/lib/format"
import { socksFromKg } from "@/lib/domain/machines"

export type SaleItemOption = { value: string; kind: StockSaleKind; label: string; availableKg: number; gramsPerSock: number | null }

const GROUPS: StockSaleKind[] = ["FINISHED", "DEFECT", "WASTE", "YARN"]

/** Ombordan sotuv: nima, necha kg, qanchaga, kimga; to'lanmagani nasiyaga */
export function StockSaleForm({ items, customers }: { items: SaleItemOption[]; customers: { name: string }[] }) {
  const t = useT()
  const locale = useLocale()
  const S = t.stockSales
  const [item, setItem] = useState("")
  const [kg, setKg] = useState("")
  const [total, setTotal] = useState("")
  const [paid, setPaid] = useState("")

  if (items.length === 0) return <p className="text-sm text-gray-500">{S.emptyStock}</p>

  const selected = items.find(i => i.value === item)
  const kgNum = parseFloat(kg)
  const totalNum = parseFloat(total)
  const paidNum = paid.trim() === "" ? totalNum : parseFloat(paid)
  const credit = totalNum > 0 && paidNum >= 0 && paidNum < totalNum ? totalNum - paidNum : 0
  const groupLabel: Record<StockSaleKind, string> = { FINISHED: S.groupFinished, DEFECT: S.groupDefect, WASTE: S.groupWaste, YARN: S.groupYarn }

  function reset() {
    setItem("")
    setKg("")
    setTotal("")
    setPaid("")
  }

  return (
    <ActionForm action={createStockSale} successMessage={S.saved} onSuccess={reset} className="space-y-4">
      <Field label={S.item}>
        <NativeSelect name="item" required value={item} onChange={e => setItem(e.target.value)}>
          <option value="" disabled>{t.common.select}</option>
          {GROUPS.map(kind => {
            const list = items.filter(i => i.kind === kind)
            if (list.length === 0) return null
            return (
              <optgroup key={kind} label={groupLabel[kind]}>
                {list.map(i => <option key={i.value} value={i.value}>{i.label} · {formatNumber(i.availableKg, locale)} kg</option>)}
              </optgroup>
            )
          })}
        </NativeSelect>
      </Field>

      <Field label={S.kg} hint={selected ? S.available(formatNumber(selected.availableKg, locale)) : undefined}>
        <Input
          name="kg" type="number" step="0.01" min="0" max={selected?.availableKg} required inputMode="decimal"
          value={kg} onChange={e => setKg(e.target.value)} className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={`${S.total} (${t.common.currency})`}>
          <Input
            name="total" type="number" step="1" min="0" required inputMode="numeric"
            value={total} onChange={e => setTotal(e.target.value)} className={inputClass}
          />
        </Field>
        <Field label={S.paid}>
          <Input
            name="paid" type="number" step="1" min="0" inputMode="numeric" placeholder={S.paidHint}
            value={paid} onChange={e => setPaid(e.target.value)} className={inputClass}
          />
        </Field>
      </div>

      {(kgNum > 0 && totalNum > 0) || credit > 0 ? (
        <div className={`rounded-xl p-3 text-sm space-y-0.5 ${credit > 0 ? "bg-amber-50 text-amber-900" : "bg-indigo-50 text-indigo-900"}`}>
          {kgNum > 0 && totalNum > 0 && <p>{S.perKgLine(formatMoney(totalNum / kgNum, locale))}</p>}
          {kgNum > 0 && selected?.gramsPerSock && <p>{t.stock.approxSocks(formatNumber(socksFromKg(kgNum, selected.gramsPerSock), locale))}</p>}
          {credit > 0 && <p className="font-bold">{S.onCreditLine(formatMoney(credit, locale))}</p>}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Field label={S.customer}>
          <Input name="customerName" list="sale-customers" placeholder={S.customerPlaceholder} required={credit > 0} className={inputClass} />
          <datalist id="sale-customers">
            {customers.map(c => <option key={c.name} value={c.name} />)}
          </datalist>
        </Field>
        <Field label={t.common.phone}>
          <Input name="customerPhone" type="tel" className={inputClass} placeholder="+998" />
        </Field>
      </div>

      <Field label={t.common.note}>
        <Input name="note" className={inputClass} placeholder={t.common.notePlaceholder} />
      </Field>

      <Button type="submit" className="w-full h-12 bg-green-600 hover:bg-green-700 text-white text-base font-bold">{S.submit}</Button>
    </ActionForm>
  )
}
