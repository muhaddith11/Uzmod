'use client'

import { useEffect, useState, useTransition } from "react"
import { produceProduct } from "@/lib/actions/production"
import { getRollOptionsForProduct } from "@/lib/actions/rolls"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { WarehouseIcon, UserIcon, DiscIcon, AlertTriangleIcon } from "lucide-react"

type RollOption = {
  materialId: string
  materialName: string
  unit: string
  quantityNeeded: number
  rolls: {
    id: string
    currentWeight: number
    initialWeight: number
    status: string
  }[]
}

type Option = { id: string; name: string }

export function ProductionForm({
  finishedGoods,
  warehouses,
  workers,
}: {
  finishedGoods: Option[]
  warehouses: Option[]
  workers: Option[]
}) {
  const [productId, setProductId] = useState("")
  const [fromWarehouseId, setFromWarehouseId] = useState(warehouses[0]?.id ?? "")
  const [quantity, setQuantity] = useState("")
  const [rollOptions, setRollOptions] = useState<RollOption[]>([])
  const [loadingRolls, setLoadingRolls] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Mahsulot yoki ombor o'zgarsa — shu resept uchun rulonli xomashyolarni qayta yuklaymiz
  useEffect(() => {
    if (!productId || !fromWarehouseId) {
      setRollOptions([])
      return
    }
    let cancelled = false
    setLoadingRolls(true)
    getRollOptionsForProduct(productId, fromWarehouseId)
      .then((opts) => { if (!cancelled) setRollOptions(opts) })
      .catch(() => { if (!cancelled) setRollOptions([]) })
      .finally(() => { if (!cancelled) setLoadingRolls(false) })
    return () => { cancelled = true }
  }, [productId, fromWarehouseId])

  const qty = parseFloat(quantity)
  const hasQty = !isNaN(qty) && qty > 0

  // onSubmit: <form action> React 19'da xato qaytganda ham maydonlarni tozalab yuborardi
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    setError(null)
    startTransition(async () => {
      const result = await produceProduct(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      form.reset()
      setQuantity("")
      setProductId("")
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-bold text-gray-700">Mahsulotni tanlang</label>
        <select
          name="productId"
          required
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="w-full p-3 border rounded-xl bg-gray-50 text-black"
        >
          <option value="">Tanlang...</option>
          {finishedGoods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-gray-700 flex items-center gap-1">
          <WarehouseIcon className="w-4 h-4" /> Xomashyo olinadigan ombor
        </label>
        <select
          name="fromWarehouseId"
          required
          value={fromWarehouseId}
          onChange={(e) => setFromWarehouseId(e.target.value)}
          className="w-full p-3 border rounded-xl bg-gray-50 text-black"
        >
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-gray-700 flex items-center gap-1">
          <WarehouseIcon className="w-4 h-4" /> Tayyor mahsulot qo'shiladigan ombor
        </label>
        <select name="toWarehouseId" required className="w-full p-3 border rounded-xl bg-gray-50 text-black">
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-gray-700">Miqdor (dona)</label>
        <Input
          name="quantityProduced"
          type="number"
          step="1"
          min="1"
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="bg-gray-50 border-gray-100 h-12 text-lg"
          placeholder="10"
        />
      </div>

      {/* Rulonli xomashyolar — har biri uchun aniq rulon tanlanadi */}
      {loadingRolls && (
        <p className="text-xs text-gray-400 italic">Rulonlar yuklanmoqda...</p>
      )}

      {rollOptions.map((opt) => {
        const needed = hasQty ? opt.quantityNeeded * qty : null
        // FIFO: tanlangan rulondan boshlab kerak bo'lsa boshqa rulonlarga o'tiladi,
        // shuning uchun jami vazn muhim, bitta rulon emas.
        const totalWeight = opt.rolls.reduce((acc, r) => acc + r.currentWeight, 0)
        const notEnoughTotal = needed !== null && totalWeight < needed - 0.0001

        return (
          <div key={opt.materialId} className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/50 p-4">
            <label className="text-sm font-bold text-gray-700 flex items-center gap-1">
              <DiscIcon className="w-4 h-4 text-amber-600" />
              {opt.materialName} — boshlang'ich rulon
            </label>
            {needed !== null && (
              <p className="text-xs text-gray-500">
                Kerak: <span className="font-bold text-gray-700">{needed} {opt.unit}</span>
                {" · "}Rulonlarda jami: <span className="font-bold text-gray-700">{totalWeight} {opt.unit}</span>
              </p>
            )}

            {opt.rolls.length === 0 ? (
              <p className="text-xs text-rose-600 font-medium">
                Bu omborda ishlatishga tayyor rulon yo'q
              </p>
            ) : (
              <>
                <select
                  name={`rollId_${opt.materialId}`}
                  required
                  className="w-full p-3 border rounded-xl bg-white text-black"
                >
                  <option value="">Rulonni tanlang...</option>
                  {opt.rolls.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.currentWeight} / {r.initialWeight} {opt.unit}
                      {r.status === 'IN_USE' ? " (ochilgan)" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400">
                  Rulon yetmasa, tizim keyingi eng eski rulonlardan avtomatik davom etadi.
                </p>
                {notEnoughTotal && (
                  <p className="text-xs text-rose-600 font-medium flex items-center gap-1">
                    <AlertTriangleIcon className="w-3 h-3" />
                    Rulonlarda jami {needed} {opt.unit} yo'q. Yangi rulon kiriting yoki miqdorni kamaytiring.
                  </p>
                )}
              </>
            )}
          </div>
        )
      })}

      <div className="space-y-2">
        <label className="text-sm font-bold text-gray-700 flex items-center gap-1">
          <UserIcon className="w-4 h-4" /> Mas'ul Ishchi (Tikuvchi)
        </label>
        <select name="workerId" required className="w-full p-3 border rounded-xl bg-indigo-50 text-black font-bold">
          <option value="">Ishchini tanlang...</option>
          {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 font-medium flex items-start gap-2">
          <AlertTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-purple-600 hover:bg-purple-700 h-12 text-lg font-bold disabled:opacity-60"
      >
        {isPending ? "Bajarilmoqda..." : "Jarayonni boshlash"}
      </Button>
    </form>
  )
}
