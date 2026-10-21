'use client'

import { useEffect, useState, useTransition } from "react"
import { produceProduct } from "@/lib/actions/production"
import { getRollOptionsForProduct } from "@/lib/actions/rolls"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, NativeSelect, inputClass } from "@/components/ui/field"
import { useLocale, useT } from "@/i18n/client"
import { formatNumber } from "@/lib/format"
import { QTY_EPSILON } from "@/lib/domain/costing"
import { WarehouseIcon, UserIcon, DiscIcon, AlertTriangleIcon, CheckCircle2Icon } from "lucide-react"

type RollOption = {
  materialId: string
  materialName: string
  unit: string
  quantityNeeded: number
  rolls: { id: string; currentWeight: number; initialWeight: number; status: string }[]
}

type Option = { id: string; name: string }

export function ProductionForm({
  finishedGoods,
  warehouses,
  workers,
  chooseWorker,
}: {
  finishedGoods: (Option & { unit: string })[]
  warehouses: Option[]
  workers: Option[]
  chooseWorker: boolean
}) {
  const t = useT()
  const locale = useLocale()
  const P = t.production
  const [productId, setProductId] = useState("")
  const [fromWarehouseId, setFromWarehouseId] = useState(warehouses[0]?.id ?? "")
  const [quantity, setQuantity] = useState("")
  const [rollOptions, setRollOptions] = useState<RollOption[]>([])
  const [loadedKey, setLoadedKey] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  const key = productId && fromWarehouseId ? `${productId}:${fromWarehouseId}` : ""
  const loadingRolls = key !== "" && key !== loadedKey

  // Mahsulot yoki ombor o'zgarsa — shu resept uchun rulonli xomashyolarni qayta yuklaymiz
  useEffect(() => {
    if (!key) return
    let cancelled = false
    getRollOptionsForProduct(productId, fromWarehouseId)
      .catch(() => [] as RollOption[])
      .then(opts => {
        if (cancelled) return
        setRollOptions(opts)
        setLoadedKey(key)
      })
    return () => { cancelled = true }
  }, [key, productId, fromWarehouseId])

  const visibleRollOptions = key && key === loadedKey ? rollOptions : []
  const unit = finishedGoods.find(p => p.id === productId)?.unit ?? ""
  const qty = parseFloat(quantity)
  const hasQty = !isNaN(qty) && qty > 0
  const fmt = (n: number) => formatNumber(n, locale)

  // onSubmit: <form action> React 19'da xato qaytganda ham maydonlarni tozalab yuborardi
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    setError(null)
    setDone(false)
    startTransition(async () => {
      const result = await produceProduct(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      form.reset()
      setQuantity("")
      setProductId("")
      // Rulon qoldiqlari o'zgardi — keyingi tanlovda qayta yuklansin
      setLoadedKey("")
      setDone(true)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label={P.product}>
        <NativeSelect name="productId" required value={productId} onChange={e => setProductId(e.target.value)}>
          <option value="">{t.common.select}</option>
          {finishedGoods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </NativeSelect>
      </Field>

      <Field label={<span className="flex items-center gap-1"><WarehouseIcon className="w-4 h-4" /> {P.fromWarehouse}</span>}>
        <NativeSelect name="fromWarehouseId" required value={fromWarehouseId} onChange={e => setFromWarehouseId(e.target.value)}>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </NativeSelect>
      </Field>

      <Field label={<span className="flex items-center gap-1"><WarehouseIcon className="w-4 h-4" /> {P.toWarehouse}</span>}>
        <NativeSelect name="toWarehouseId" required>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </NativeSelect>
      </Field>

      <Field label={`${P.quantity}${unit ? ` (${unit})` : ""}`}>
        <Input
          name="quantityProduced"
          type="number"
          step="1"
          min="1"
          required
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          className={`${inputClass} text-lg`}
          placeholder="10"
        />
      </Field>

      {loadingRolls && <p className="text-xs text-gray-400 italic">{P.loadingRolls}</p>}

      {visibleRollOptions.map(opt => {
        const needed = hasQty ? opt.quantityNeeded * qty : null
        // FIFO: tanlangan rulondan boshlab kerak bo'lsa boshqa rulonlarga o'tiladi,
        // shuning uchun jami vazn muhim, bitta rulon emas.
        const totalWeight = opt.rolls.reduce((acc, r) => acc + r.currentWeight, 0)
        const notEnoughTotal = needed !== null && totalWeight < needed - QTY_EPSILON

        return (
          <div key={opt.materialId} className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/50 p-4">
            <label className="text-sm font-bold text-gray-700 flex items-center gap-1">
              <DiscIcon className="w-4 h-4 text-amber-600" />
              {P.startingRoll(opt.materialName)}
            </label>
            {needed !== null && (
              <p className="text-xs text-gray-500">
                {P.needed}: <span className="font-bold text-gray-700">{fmt(needed)} {opt.unit}</span>
                {" · "}{P.rollsTotal}: <span className="font-bold text-gray-700">{fmt(totalWeight)} {opt.unit}</span>
              </p>
            )}

            {opt.rolls.length === 0 ? (
              <p className="text-xs text-rose-600 font-medium">{P.noRollsHere}</p>
            ) : (
              <>
                <NativeSelect name={`rollId_${opt.materialId}`} required className="bg-white">
                  <option value="">{P.selectRoll}</option>
                  {opt.rolls.map(r => (
                    <option key={r.id} value={r.id}>
                      {fmt(r.currentWeight)} / {fmt(r.initialWeight)} {opt.unit}
                      {r.status === 'IN_USE' ? ` ${P.opened}` : ""}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-[11px] text-gray-500">{P.fifoHint}</p>
                {notEnoughTotal && (
                  <p className="text-xs text-rose-600 font-medium flex items-center gap-1">
                    <AlertTriangleIcon className="w-3 h-3" />
                    {P.notEnoughInRolls(fmt(needed ?? 0), opt.unit)}
                  </p>
                )}
              </>
            )}
          </div>
        )
      })}

      {chooseWorker && (
        <Field label={<span className="flex items-center gap-1"><UserIcon className="w-4 h-4" /> {P.responsible}</span>}>
          <NativeSelect name="workerId" required className="bg-indigo-50 font-bold">
            <option value="">{P.selectWorker}</option>
            {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </NativeSelect>
        </Field>
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
          <span>{P.done}</span>
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-purple-600 hover:bg-purple-700 h-12 text-lg font-bold disabled:opacity-60"
      >
        {isPending ? P.submitting : P.submit}
      </Button>
    </form>
  )
}
