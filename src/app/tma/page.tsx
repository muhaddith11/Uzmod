'use client'

import { useEffect, useState } from "react"
import { signIn } from "next-auth/react"
import { authenticateTMA } from "@/lib/actions/tma"
import { getProducts } from "@/lib/actions/products"
import { getWarehouses } from "@/lib/actions/warehouses"
import { produceProduct } from "@/lib/actions/production"
import { createRolls } from "@/lib/actions/rolls"
import { getRollOptionsForProduct } from "@/lib/actions/rolls"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HammerIcon, Loader2Icon, CheckCircle2Icon, AlertCircleIcon, LayersIcon, WeightIcon, DiscIcon } from "lucide-react"

type RollOption = {
  materialId: string
  materialName: string
  unit: string
  quantityNeeded: number
  rolls: { id: string; currentWeight: number; initialWeight: number; status: string }[]
}

export default function TMAPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Tikuv formasi holati — rulon tanlash uchun mahsulot/omborni kuzatamiz
  const [prodProductId, setProdProductId] = useState("")
  const [prodFromWh, setProdFromWh] = useState("")
  const [prodQty, setProdQty] = useState("")
  const [rollOptions, setRollOptions] = useState<RollOption[]>([])

  useEffect(() => {
    async function initTMA() {
      const tg = (window as any).Telegram?.WebApp
      if (!tg) {
        setLoading(false)
        return
      }

      tg.expand()

      try {
        // 1. initData'ni tekshirish + foydalanuvchi ulanganini aniqlash
        const result = await authenticateTMA(tg.initData)
        if (!result.success) {
          setUser({ notLinked: true, telegramId: result.telegramId, name: result.name })
          return
        }

        // 2. Haqiqiy sessiya yaratish (aks holda server action'lar "Avtorizatsiya kerak" beradi)
        const signInResult = await signIn("telegram", { initData: tg.initData, redirect: false })
        if (signInResult?.error) {
          setStatus({ type: 'error', message: "Sessiya yaratilmadi. Qayta urinib ko'ring." })
          return
        }

        setUser(result.user)

        // 3. Endi sessiya bor — ma'lumotlarni yuklaymiz
        const [pData, wData] = await Promise.all([getProducts(), getWarehouses()])
        setProducts(pData)
        setWarehouses(wData)
        if (wData[0]) setProdFromWh(wData[0].id)
      } catch (err) {
        console.error(err)
        setStatus({ type: 'error', message: "Xatolik yuz berdi" })
      } finally {
        setLoading(false)
      }
    }

    initTMA()
  }, [])

  // Mahsulot yoki ombor o'zgarsa — rulonli xomashyolarni qayta yuklaymiz
  useEffect(() => {
    if (!prodProductId || !prodFromWh) {
      setRollOptions([])
      return
    }
    let cancelled = false
    getRollOptionsForProduct(prodProductId, prodFromWh)
      .then(opts => { if (!cancelled) setRollOptions(opts) })
      .catch(() => { if (!cancelled) setRollOptions([]) })
    return () => { cancelled = true }
  }, [prodProductId, prodFromWh])

  async function handleProduce(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setStatus(null)
    // currentTarget await'dan keyin null bo'lib qoladi — formani oldindan olamiz
    const form = e.currentTarget
    const formData = new FormData(form)

    try {
      const result = await produceProduct(formData)
      if (result.error) {
        setStatus({ type: 'error', message: result.error })
        return
      }
      setStatus({ type: 'success', message: "Tikuv qaydi saqlandi!" })
      form.reset()
      setProdProductId("")
      setProdQty("")
      setRollOptions([])
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRolls(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setStatus(null)
    const form = e.currentTarget
    const formData = new FormData(form)

    try {
      const result = await createRolls(formData)
      if (result.error) {
        setStatus({ type: 'error', message: result.error })
        return
      }
      setStatus({ type: 'success', message: "Rulonlar qabul qilindi!" })
      form.reset()
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2Icon className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!user || user.notLinked) {
    return (
      <div className="p-8 text-center space-y-6 min-h-screen flex flex-col items-center justify-center bg-white text-black">
        <div className="bg-orange-100 p-6 rounded-full">
          <AlertCircleIcon className="w-12 h-12 text-orange-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black">Bog'lanmagan hisob</h1>
          <p className="text-gray-500">
            Salom, {user?.name || "Foydalanuvchi"}! Sizning Telegram ID-ingiz tizimga ulanmagan.
          </p>
        </div>
        <div className="bg-gray-50 p-4 rounded-xl font-mono text-sm w-full">
          ID: {user?.telegramId}
        </div>
        <p className="text-xs text-gray-400">
          Saytdagi Profil sahifasida «Telegram'ni ulash» tugmasini bosing, so'ng ilovani qayta oching.
        </p>
      </div>
    )
  }

  const rawMaterials = products.filter(p => p.isRawMaterial)
  const finishedGoods = products.filter(p => !p.isRawMaterial)
  const qtyNum = parseFloat(prodQty)

  return (
    <div className="p-4 space-y-6 bg-gray-50 min-h-screen pb-20">
      <header className="flex justify-between items-center text-black">
        <div>
          <h1 className="text-xl font-black">{user.orgName || "Uzmod"}</h1>
          <p className="text-xs text-gray-500 font-bold uppercase">{user.name}</p>
        </div>
        <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">
          Online
        </div>
      </header>

      <Tabs defaultValue="production" className="w-full">
        <TabsList className="grid grid-cols-2 bg-gray-100 rounded-2xl p-1 mb-4 h-12">
          <TabsTrigger value="production" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-xs">
             <HammerIcon className="w-4 h-4 mr-1" /> Tikuv
          </TabsTrigger>
          <TabsTrigger value="rolls" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-xs">
             <LayersIcon className="w-4 h-4 mr-1" /> Rulonlar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="production">
          <Card className="rounded-3xl shadow-sm border-none bg-white">
            <CardHeader>
              <CardTitle className="text-lg text-black">Tikuvni qayd etish</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProduce} className="space-y-6">
                <div className="space-y-2 text-black">
                  <label className="text-xs font-bold text-gray-400 uppercase">Tayyor mahsulot</label>
                  <select
                    name="productId"
                    required
                    value={prodProductId}
                    onChange={(e) => setProdProductId(e.target.value)}
                    className="w-full p-4 bg-gray-100 rounded-2xl border-none font-bold"
                  >
                    <option value="">Tanlang...</option>
                    {finishedGoods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2 text-black">
                  <label className="text-xs font-bold text-gray-400 uppercase">Miqdor (dona)</label>
                  <Input
                    name="quantityProduced"
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={prodQty}
                    onChange={(e) => setProdQty(e.target.value)}
                    className="h-14 bg-gray-100 border-none rounded-2xl text-xl font-black"
                    placeholder="0"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 text-black">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Xomashyo ombori</label>
                    <select
                      name="fromWarehouseId"
                      required
                      value={prodFromWh}
                      onChange={(e) => setProdFromWh(e.target.value)}
                      className="w-full p-3 bg-gray-100 rounded-xl border-none text-xs font-bold"
                    >
                       {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1 text-black">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Qabul ombori</label>
                    <select name="toWarehouseId" required className="w-full p-3 bg-gray-100 rounded-xl border-none text-xs font-bold">
                       {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Rulonli xomashyolar — ishchi boshlang'ich rulonni tanlaydi,
                    yetmasa tizim FIFO bo'yicha keyingi rulonlarga o'tadi */}
                {rollOptions.map((opt) => {
                  const needed = !isNaN(qtyNum) && qtyNum > 0 ? opt.quantityNeeded * qtyNum : null
                  const totalWeight = opt.rolls.reduce((acc, r) => acc + r.currentWeight, 0)
                  const notEnoughTotal = needed !== null && totalWeight < needed - 0.0001
                  return (
                    <div key={opt.materialId} className="space-y-2 rounded-2xl bg-amber-50 p-4 text-black">
                      <label className="text-xs font-bold text-amber-700 uppercase flex items-center gap-1">
                        <DiscIcon className="w-3 h-3" /> {opt.materialName} — boshlang'ich rulon
                      </label>
                      {needed !== null && (
                        <p className="text-[10px] text-gray-500 font-bold">
                          Kerak: {needed} {opt.unit} · Jami: {totalWeight} {opt.unit}
                        </p>
                      )}
                      {opt.rolls.length === 0 ? (
                        <p className="text-[10px] text-rose-600 font-bold">Bu omborda tayyor rulon yo'q</p>
                      ) : (
                        <>
                          <select
                            name={`rollId_${opt.materialId}`}
                            required
                            className="w-full p-3 bg-white rounded-xl border-none text-sm font-bold"
                          >
                            <option value="">Rulonni tanlang...</option>
                            {opt.rolls.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.currentWeight}/{r.initialWeight} {opt.unit}
                              </option>
                            ))}
                          </select>
                          {notEnoughTotal && (
                            <p className="text-[10px] text-rose-600 font-bold">
                              Rulonlarda jami {needed} {opt.unit} yo'q
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}

                <Button disabled={isSubmitting} className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-lg font-black">
                  {isSubmitting ? "Yuborilmoqda..." : "Tasdiqlash"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rolls">
          <Card className="rounded-3xl shadow-sm border-none bg-white">
            <CardHeader>
              <CardTitle className="text-lg text-black">Rulonlarni qabul qilish</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRolls} className="space-y-6">
                <div className="space-y-2 text-black">
                  <label className="text-xs font-bold text-gray-400 uppercase">Mato turi (Xomashyo)</label>
                  <select name="productId" required className="w-full p-4 bg-gray-100 rounded-2xl border-none font-bold">
                    <option value="">Tanlang...</option>
                    {rawMaterials.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2 text-black">
                  <label className="text-xs font-bold text-gray-400 uppercase">Ombor</label>
                  <select name="warehouseId" required className="w-full p-4 bg-gray-100 rounded-2xl border-none font-bold">
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2 text-black">
                  <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                    <WeightIcon className="w-3 h-3" /> Og'irliklar (vergul bilan)
                  </label>
                  <textarea
                    name="weights"
                    required
                    rows={3}
                    placeholder="Masalan: 25.4, 26, 24.8"
                    className="w-full p-4 bg-gray-100 rounded-2xl border-none font-bold text-lg resize-none focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <p className="text-[10px] text-gray-400 font-medium">Har bir rulon vaznini vergul yoki bo'sh joy bilan kiriting</p>
                </div>

                <Button disabled={isSubmitting} className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-lg font-black">
                  {isSubmitting ? "Yuborilmoqda..." : "Rulonlarni saqlash"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {status && (
        <div className={`p-4 rounded-2xl flex items-center gap-2 font-bold text-sm ${status.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {status.type === 'success' ? <CheckCircle2Icon className="w-5 h-5" /> : <AlertCircleIcon className="w-5 h-5" />}
          {status.message}
        </div>
      )}

      <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
        Uzmod Warehouse v1.0
      </p>

      {/* Telegram SDK Script */}
      <script src="https://telegram.org/js/telegram-web-app.js" async />
    </div>
  )
}
