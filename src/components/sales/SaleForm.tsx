'use client'

import { useMemo, useState, useTransition } from "react"
import { createSale } from "@/lib/actions/sales"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, NativeSelect, inputClass } from "@/components/ui/field"
import { useLocale, useT } from "@/i18n/client"
import { formatMoney, formatNumber } from "@/lib/format"
import { roundMoney } from "@/lib/domain/costing"
import { AlertTriangleIcon, CheckCircle2Icon, PlusIcon, Trash2Icon } from "lucide-react"

export type SaleProductOption = {
  id: string
  name: string
  unit: string
  price: number
  // Ombor bo'yicha qoldiq: warehouseId → miqdor
  stock: Record<string, number>
}

type Line = { key: number; productId: string; quantity: string; price: string }

let nextKey = 1
const emptyLine = (): Line => ({ key: nextKey++, productId: "", quantity: "", price: "" })

export function SaleForm({
  products,
  warehouses,
  customers,
}: {
  products: SaleProductOption[]
  warehouses: { id: string; name: string }[]
  customers: { id: string; name: string }[]
}) {
  const t = useT()
  const locale = useLocale()
  const S = t.sales
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "")
  const [customerId, setCustomerId] = useState("")
  const [paymentType, setPaymentType] = useState<"CASH" | "CARD" | "DEBT">("CASH")
  const [paid, setPaid] = useState("")
  const [lines, setLines] = useState<Line[]>(() => [emptyLine()])
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  const byId = useMemo(() => new Map(products.map(p => [p.id, p])), [products])

  const total = roundMoney(lines.reduce((acc, l) => {
    const q = parseFloat(l.quantity)
    const p = parseFloat(l.price)
    return acc + (q > 0 && p >= 0 ? q * p : 0)
  }, 0))
  const paidNum = parseFloat(paid)
  const debt = !isNaN(paidNum) ? roundMoney(total - paidNum) : 0

  function updateLine(key: number, patch: Partial<Line>) {
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l
      const next = { ...l, ...patch }
      // Mahsulot tanlanganda katalogdagi sotuv narxi taklif qilinadi
      if (patch.productId !== undefined && patch.productId !== l.productId) {
        const product = byId.get(patch.productId)
        next.price = product ? String(product.price) : ""
      }
      return next
    }))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set("items", JSON.stringify(
      lines
        .filter(l => l.productId)
        .map(l => ({ productId: l.productId, quantity: l.quantity, price: l.price }))
    ))
    setError(null)
    setDone(false)
    startTransition(async () => {
      const result = await createSale(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      setLines([emptyLine()])
      setPaid("")
      setCustomerId("")
      setPaymentType("CASH")
      setDone(true)
    })
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-5 ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={S.warehouse}>
          <NativeSelect name="warehouseId" required value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label={S.customer}>
          <NativeSelect name="customerId" value={customerId} onChange={e => setCustomerId(e.target.value)}>
            <option value="">{S.noCustomer}</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
        </Field>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700">{S.items}</p>
        {lines.map((line, index) => {
          const product = byId.get(line.productId)
          const available = product ? (product.stock[warehouseId] ?? 0) : null
          const qty = parseFloat(line.quantity)
          const over = available !== null && qty > available
          const lineTotal = qty > 0 && parseFloat(line.price) >= 0 ? qty * parseFloat(line.price) : 0
          return (
            <div key={line.key} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 space-y-2">
              <div className="flex gap-2">
                <NativeSelect
                  aria-label={`${t.common.product} ${index + 1}`}
                  value={line.productId}
                  onChange={e => updateLine(line.key, { productId: e.target.value })}
                  className="bg-white"
                >
                  <option value="">{t.common.selectProduct}</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </NativeSelect>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 text-gray-400 hover:text-rose-600 shrink-0"
                  onClick={() => setLines(prev => prev.length > 1 ? prev.filter(l => l.key !== line.key) : [emptyLine()])}
                  title={S.removeLine}
                  aria-label={S.removeLine}
                >
                  <Trash2Icon className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  aria-label={t.common.quantity}
                  type="number" step="0.001" min="0"
                  placeholder={`${t.common.quantity}${product ? ` (${product.unit})` : ""}`}
                  value={line.quantity}
                  onChange={e => updateLine(line.key, { quantity: e.target.value })}
                  className={`${inputClass} bg-white ${over ? "border-rose-300" : ""}`}
                />
                <Input
                  aria-label={S.unitPrice}
                  type="number" step="0.01" min="0"
                  placeholder={S.unitPrice}
                  value={line.price}
                  onChange={e => updateLine(line.key, { price: e.target.value })}
                  className={`${inputClass} bg-white`}
                />
              </div>
              <div className="flex justify-between text-xs">
                <span className={over ? "text-rose-600 font-bold" : "text-gray-500"}>
                  {available !== null && product && `${S.available}: ${formatNumber(available, locale)} ${product.unit}`}
                </span>
                <span className="font-bold text-gray-700">{formatMoney(lineTotal, locale)}</span>
              </div>
            </div>
          )
        })}
        <Button type="button" variant="outline" className="w-full h-10 gap-1 border-dashed" onClick={() => setLines(prev => [...prev, emptyLine()])}>
          <PlusIcon className="w-4 h-4" /> {S.addLine}
        </Button>
      </div>

      <div className="rounded-xl bg-indigo-50 p-4 flex justify-between items-center">
        <span className="text-sm font-bold text-indigo-900">{S.total}</span>
        <span className="text-2xl font-black text-indigo-700">{formatMoney(total, locale)}</span>
      </div>

      <Field label={S.paymentType}>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={S.paymentType}>
          {(["CASH", "CARD", "DEBT"] as const).map(type => (
            <label
              key={type}
              className={`flex items-center justify-center h-11 rounded-xl border text-sm font-bold cursor-pointer transition-colors ${
                paymentType === type ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio" name="paymentType" value={type} className="sr-only"
                checked={paymentType === type}
                onChange={() => {
                  setPaymentType(type)
                  if (type === "DEBT") setPaid("0")
                }}
              />
              {S.payment[type]}
            </label>
          ))}
        </div>
      </Field>

      <Field label={`${S.paidAmount} (${t.common.currency})`}>
        <div className="flex gap-2">
          <Input
            name="paidAmount" type="number" step="0.01" min="0" required
            value={paid}
            onChange={e => setPaid(e.target.value)}
            className={inputClass}
          />
          <Button type="button" variant="outline" className="h-11 shrink-0" onClick={() => setPaid(String(total))}>
            {S.payFull}
          </Button>
        </div>
      </Field>
      {debt > 0 && (
        <p className="text-sm text-amber-700 font-medium">{S.debtPart}: {formatMoney(debt, locale)}</p>
      )}

      {error && (
        <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 font-medium flex items-start gap-2">
          <AlertTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {done && !error && (
        <div role="status" className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-700 font-medium flex items-start gap-2">
          <CheckCircle2Icon className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{S.done}</span>
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg font-bold text-white">
        {isPending ? S.submitting : S.submit}
      </Button>
    </form>
  )
}
