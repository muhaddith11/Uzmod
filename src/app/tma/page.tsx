'use client'

import { useEffect, useState } from "react"
import { signIn } from "next-auth/react"
import Script from "next/script"
import { authenticateTMA, getTmaData } from "@/lib/actions/tma"
import { produceProduct } from "@/lib/actions/production"
import { createRolls, getRollOptionsForProduct } from "@/lib/actions/rolls"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLocale, useT } from "@/i18n/client"
import { formatNumber } from "@/lib/format"
import { QTY_EPSILON } from "@/lib/domain/costing"
import { HammerIcon, Loader2Icon, CheckCircle2Icon, AlertCircleIcon, LayersIcon, WeightIcon, DiscIcon } from "lucide-react"

type RollOption = {
  materialId: string
  materialName: string
  unit: string
  quantityNeeded: number
  rolls: { id: string; currentWeight: number; initialWeight: number; status: string }[]
}

type TmaProduct = { id: string; name: string; unit: string; isRawMaterial: boolean; isRollTracked: boolean }
type TmaUser = { id: string; name: string | null; orgName: string }
type Gate =
  | { kind: "loading" }
  | { kind: "noTelegram" }
  | { kind: "notLinked"; telegramId: string; name: string }
  | { kind: "blocked" }
  | { kind: "ready"; user: TmaUser }

type TelegramWebApp = { initData: string; expand: () => void }

const selectClass = "w-full p-4 bg-gray-100 rounded-2xl border-none font-bold text-black"

export default function TMAPage() {
  const t = useT()
  const locale = useLocale()
  const M = t.tma
  const [gate, setGate] = useState<Gate>({ kind: "loading" })
  const [sdkReady, setSdkReady] = useState(false)
  const [products, setProducts] = useState<TmaProduct[]>([])
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([])
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Tikuv formasi holati — rulon tanlash uchun mahsulot/omborni kuzatamiz
  const [prodProductId, setProdProductId] = useState("")
  const [prodFromWh, setProdFromWh] = useState("")
  const [prodQty, setProdQty] = useState("")
  const [rollOptions, setRollOptions] = useState<RollOption[]>([])
  const [rollKey, setRollKey] = useState("")

  useEffect(() => {
    if (!sdkReady) return
    const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp
    let cancelled = false

    async function init() {
      if (!tg?.initData) {
        setGate({ kind: "noTelegram" })
        return
      }
      tg.expand()
      try {
        // 1. initData'ni tekshirish + foydalanuvchi ulanganini aniqlash
        const result = await authenticateTMA(tg.initData)
        if (cancelled) return
        if (!result.success) {
          setGate("blocked" in result && result.blocked
            ? { kind: "blocked" }
            : { kind: "notLinked", telegramId: result.telegramId, name: result.name })
          return
        }

        // 2. Haqiqiy sessiya (aks holda server action'lar "Avtorizatsiya kerak" beradi)
        const signInResult = await signIn("telegram", { initData: tg.initData, redirect: false })
        if (signInResult?.error) {
          setGate(signInResult.code === "blocked" ? { kind: "blocked" } : { kind: "noTelegram" })
          setStatus({ type: 'error', message: M.sessionFailed })
          return
        }

        // 3. Sessiya bor — ma'lumotlarni yuklaymiz (faqat oddiy maydonlar keladi)
        const data = await getTmaData()
        if (cancelled) return
        setProducts(data.products)
        setWarehouses(data.warehouses)
        if (data.warehouses[0]) setProdFromWh(data.warehouses[0].id)
        setGate({ kind: "ready", user: result.user })
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setGate({ kind: "noTelegram" })
          setStatus({ type: 'error', message: t.errors.generic })
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, [sdkReady, M.sessionFailed, t.errors.generic])

  // Mahsulot yoki ombor o'zgarsa — rulonli xomashyolarni qayta yuklaymiz
  const wantedKey = prodProductId && prodFromWh ? `${prodProductId}:${prodFromWh}` : ""
  useEffect(() => {
    if (!wantedKey) return
    let cancelled = false
    getRollOptionsForProduct(prodProductId, prodFromWh)
      .catch(() => [] as RollOption[])
      .then(opts => {
        if (cancelled) return
        setRollOptions(opts)
        setRollKey(wantedKey)
      })
    return () => { cancelled = true }
  }, [wantedKey, prodProductId, prodFromWh])
  const visibleRollOptions = wantedKey && wantedKey === rollKey ? rollOptions : []

  async function submit(form: HTMLFormElement, run: (fd: FormData) => Promise<{ error?: string }>, okMessage: string, after?: () => void) {
    setIsSubmitting(true)
    setStatus(null)
    try {
      const result = await run(new FormData(form))
      if (result.error) {
        setStatus({ type: 'error', message: result.error })
        return
      }
      setStatus({ type: 'success', message: okMessage })
      form.reset()
      after?.()
    } catch {
      setStatus({ type: 'error', message: t.errors.generic })
    } finally {
      setIsSubmitting(false)
    }
  }

  const sdk = <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" onReady={() => setSdkReady(true)} />

  if (gate.kind === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        {sdk}
        <Loader2Icon className="w-10 h-10 animate-spin text-indigo-600" aria-label={t.common.loading} />
      </div>
    )
  }

  if (gate.kind !== "ready") {
    const title = gate.kind === "blocked" ? M.blockedTitle : M.notLinkedTitle
    const text =
      gate.kind === "blocked" ? M.blockedText
      : gate.kind === "notLinked" ? M.notLinkedText(gate.name || "")
      : M.openInTelegram
    return (
      <div className="p-8 text-center space-y-6 min-h-screen flex flex-col items-center justify-center bg-white text-black">
        {sdk}
        <div className="bg-orange-100 p-6 rounded-full">
          <AlertCircleIcon className="w-12 h-12 text-orange-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black">{title}</h1>
          <p className="text-gray-500">{text}</p>
        </div>
        {gate.kind === "notLinked" && (
          <>
            <div className="bg-gray-50 p-4 rounded-xl font-mono text-sm w-full">ID: {gate.telegramId}</div>
            <p className="text-xs text-gray-400">{M.notLinkedHint}</p>
          </>
        )}
        {status && <p className="text-sm text-red-600">{status.message}</p>}
      </div>
    )
  }

  const rollMaterials = products.filter(p => p.isRawMaterial && p.isRollTracked)
  const finishedGoods = products.filter(p => !p.isRawMaterial)
  const qtyNum = parseFloat(prodQty)
  const fmt = (n: number) => formatNumber(n, locale)

  return (
    <div className="p-4 space-y-6 bg-gray-50 min-h-screen pb-20">
      {sdk}
      <header className="flex justify-between items-center text-black">
        <div>
          <h1 className="text-xl font-black">{gate.user.orgName}</h1>
          <p className="text-xs text-gray-500 font-bold uppercase">{gate.user.name}</p>
        </div>
        <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">{M.online}</div>
      </header>

      <Tabs defaultValue="production" className="w-full">
        <TabsList className="grid grid-cols-2 bg-gray-100 rounded-2xl p-1 mb-4 h-12 w-full">
          <TabsTrigger value="production" className="rounded-xl font-bold text-xs">
            <HammerIcon className="w-4 h-4 mr-1" /> {M.tabProduction}
          </TabsTrigger>
          <TabsTrigger value="rolls" className="rounded-xl font-bold text-xs">
            <LayersIcon className="w-4 h-4 mr-1" /> {M.tabRolls}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="production">
          <Card className="rounded-3xl shadow-sm border-none bg-white">
            <CardHeader>
              <CardTitle className="text-lg text-black">{M.productionTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={e => {
                  e.preventDefault()
                  submit(e.currentTarget, produceProduct, M.productionSaved, () => {
                    setProdProductId("")
                    setProdQty("")
                    setRollKey("")
                  })
                }}
                className="space-y-6"
              >
                <div className="space-y-2 text-black">
                  <label className="text-xs font-bold text-gray-400 uppercase" htmlFor="tma-product">{M.finishedProduct}</label>
                  <select id="tma-product" name="productId" required value={prodProductId} onChange={e => setProdProductId(e.target.value)} className={selectClass}>
                    <option value="">{t.common.select}</option>
                    {finishedGoods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2 text-black">
                  <label className="text-xs font-bold text-gray-400 uppercase" htmlFor="tma-qty">{t.common.quantity}</label>
                  <Input
                    id="tma-qty" name="quantityProduced" type="number" step="1" min="1" required
                    value={prodQty} onChange={e => setProdQty(e.target.value)}
                    className="h-14 bg-gray-100 border-none rounded-2xl text-xl font-black"
                    placeholder="0"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 text-black">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase" htmlFor="tma-from">{M.rawWarehouse}</label>
                    <select id="tma-from" name="fromWarehouseId" required value={prodFromWh} onChange={e => setProdFromWh(e.target.value)} className="w-full p-3 bg-gray-100 rounded-xl border-none text-xs font-bold">
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase" htmlFor="tma-to">{M.targetWarehouse}</label>
                    <select id="tma-to" name="toWarehouseId" required className="w-full p-3 bg-gray-100 rounded-xl border-none text-xs font-bold">
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Rulonli xomashyo — ishchi boshlang'ich rulonni tanlaydi, yetmasa FIFO */}
                {visibleRollOptions.map(opt => {
                  const needed = !isNaN(qtyNum) && qtyNum > 0 ? opt.quantityNeeded * qtyNum : null
                  const totalWeight = opt.rolls.reduce((acc, r) => acc + r.currentWeight, 0)
                  const notEnough = needed !== null && totalWeight < needed - QTY_EPSILON
                  return (
                    <div key={opt.materialId} className="space-y-2 rounded-2xl bg-amber-50 p-4 text-black">
                      <label className="text-xs font-bold text-amber-700 uppercase flex items-center gap-1">
                        <DiscIcon className="w-3 h-3" /> {t.production.startingRoll(opt.materialName)}
                      </label>
                      {needed !== null && (
                        <p className="text-[11px] text-gray-500 font-bold">
                          {t.production.needed}: {fmt(needed)} {opt.unit} · {t.production.rollsTotal}: {fmt(totalWeight)} {opt.unit}
                        </p>
                      )}
                      {opt.rolls.length === 0 ? (
                        <p className="text-[11px] text-rose-600 font-bold">{t.production.noRollsHere}</p>
                      ) : (
                        <>
                          <select name={`rollId_${opt.materialId}`} required className="w-full p-3 bg-white rounded-xl border-none text-sm font-bold">
                            <option value="">{t.production.selectRoll}</option>
                            {opt.rolls.map(r => (
                              <option key={r.id} value={r.id}>{fmt(r.currentWeight)}/{fmt(r.initialWeight)} {opt.unit}</option>
                            ))}
                          </select>
                          {notEnough && <p className="text-[11px] text-rose-600 font-bold">{t.production.notEnoughInRolls(fmt(needed ?? 0), opt.unit)}</p>}
                        </>
                      )}
                    </div>
                  )
                })}

                <Button type="submit" disabled={isSubmitting} className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-lg font-black">
                  {isSubmitting ? M.sending : M.confirm}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rolls">
          <Card className="rounded-3xl shadow-sm border-none bg-white">
            <CardHeader>
              <CardTitle className="text-lg text-black">{M.rollsTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={e => {
                  e.preventDefault()
                  submit(e.currentTarget, createRolls, M.rollsSaved, () => setRollKey(""))
                }}
                className="space-y-6"
              >
                <div className="space-y-2 text-black">
                  <label className="text-xs font-bold text-gray-400 uppercase" htmlFor="tma-roll-product">{M.rollMaterial}</label>
                  <select id="tma-roll-product" name="productId" required className={selectClass}>
                    <option value="">{t.common.select}</option>
                    {rollMaterials.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                  </select>
                </div>

                <div className="space-y-2 text-black">
                  <label className="text-xs font-bold text-gray-400 uppercase" htmlFor="tma-roll-wh">{t.common.warehouse}</label>
                  <select id="tma-roll-wh" name="warehouseId" required className={selectClass}>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2 text-black">
                  <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1" htmlFor="tma-weights">
                    <WeightIcon className="w-3 h-3" /> {M.weights}
                  </label>
                  <textarea
                    id="tma-weights" name="weights" required rows={3}
                    placeholder={M.weightsPlaceholder}
                    className="w-full p-4 bg-gray-100 rounded-2xl border-none font-bold text-lg resize-none focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <p className="text-[11px] text-gray-400 font-medium">{M.weightsHint}</p>
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-lg font-black">
                  {isSubmitting ? M.sending : M.saveRolls}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {status && (
        <div role={status.type === 'error' ? "alert" : "status"} className={`p-4 rounded-2xl flex items-center gap-2 font-bold text-sm ${status.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {status.type === 'success' ? <CheckCircle2Icon className="w-5 h-5" /> : <AlertCircleIcon className="w-5 h-5" />}
          {status.message}
        </div>
      )}
    </div>
  )
}
