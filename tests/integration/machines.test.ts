import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { receiveYarn, getYarnStock } from "@/lib/actions/yarn"
import { cancelLoad, createMachines, finishLoadNow, getMachineReport, getMachinesBoard, loadMachines } from "@/lib/actions/machines"
import { getStockOverview, markDefect } from "@/lib/actions/batches"
import { updateAutoTransfer } from "@/lib/actions/settings"
import { buildTimesheet } from "@/lib/attendance"
import { asUser, form, resetDb, seedWorkshop } from "../helpers"

let w: Awaited<ReturnType<typeof seedWorkshop>>

const lines = (items: { type: string; color: string; kg: number }[]) => JSON.stringify(items)
const HOUR = 60 * 60 * 1000

async function yarnId(type: string, color: string) {
  return (await prisma.product.findFirstOrThrow({ where: { organizationId: w.org.id, yarnType: type, color } })).id
}

/** Ip qoldig'i — barcha omborlarda (sexda bitta ombor ishlatiladi) */
async function yarnKg(productId: string) {
  const agg = await prisma.stockLevel.aggregate({ where: { productId }, _sum: { quantity: true } })
  return agg._sum.quantity ?? 0
}

function at(iso: string) {
  vi.setSystemTime(new Date(iso))
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  at("2026-10-22T05:00:00Z") // 10:00 Toshkent
  await resetDb()
  w = await seedWorkshop()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("ip qabul qilish", () => {
  it("tur+rang bo'yicha ip yaratadi, keyingi qabul — o'sha ipga (katta-kichik harf farqsiz), narxsiz", async () => {
    asUser(w.manager)
    expect(await receiveYarn(form({
      lines: lines([
        { type: "Supreme", color: "Qora", kg: 1000 },
        { type: "Supreme", color: "Oq", kg: 800 },
        { type: "X/B", color: "Qora", kg: 1200 },
      ]),
    }))).toEqual({})
    expect(await receiveYarn(form({ lines: lines([{ type: "supreme", color: "qora", kg: 1000 }]) }))).toEqual({})

    const supremeBlack = await yarnId("Supreme", "Qora")
    expect(await yarnKg(supremeBlack)).toBe(2000)
    expect(await prisma.product.count({ where: { organizationId: w.org.id, yarnType: { not: null } } })).toBe(3)

    const stock = await getYarnStock()
    expect(stock.find(s => s.id === supremeBlack)).toMatchObject({ stockKg: 2000, todayKg: 2000, name: "Supreme — Qora" })
    expect((await getStockOverview()).yarnKg).toBe(4000)
  })

  it("bo'sh qator va manfiy og'irlik rad etiladi; ishchi ip qabul qila olmaydi", async () => {
    asUser(w.manager)
    expect((await receiveYarn(form({ lines: "[]" }))).error).toMatch(/Kamida bitta/)
    expect((await receiveYarn(form({ lines: lines([{ type: "S", color: "Q", kg: -5 }]) }))).error).toBeTruthy()
    asUser(w.worker)
    expect((await receiveYarn(form({ lines: lines([{ type: "S", color: "Q", kg: 5 }]) }))).error).toMatch(/ruxsat/)
  })
})

describe("stanoklar va tayyor partiyalar", () => {
  let yarn: string

  beforeEach(async () => {
    asUser(w.admin)
    expect(await createMachines(form({ from: 1, to: 53, group: "A" }))).toEqual({})
    expect(await createMachines(form({ from: 54, to: 99, group: "B" }))).toEqual({})
    asUser(w.manager)
    await receiveYarn(form({ lines: lines([{ type: "Supreme", color: "Qora", kg: 500 }]) }))
    yarn = await yarnId("Supreme", "Qora")
  })

  it("99 ta stanok, takroriy raqam rad etiladi", async () => {
    expect(await prisma.machine.count({ where: { organizationId: w.org.id } })).toBe(99)
    asUser(w.admin)
    expect((await createMachines(form({ from: 50, to: 60, group: "C" }))).error).toMatch(/allaqachon/)
  })

  it("ip qo'yiladi → 24 soatdan keyin o'zi partiyaga o'tadi; brak va hisobot", async () => {
    asUser(w.worker)
    // 1-3 stanoklarga 10 kg dan, 25 g → har biridan 400 dona
    expect(await loadMachines(form({ machines: "1-3", yarnId: yarn, gramsPerSock: 25, kgPerMachine: 10, workerId: w.worker2.id }))).toEqual({})
    expect(await yarnKg(yarn)).toBe(470)
    expect((await loadMachines(form({ machines: "150", yarnId: yarn, gramsPerSock: 25, kgPerMachine: 1 }))).error).toMatch(/Bunday stanok yo'q/)

    const board = await getMachinesBoard()
    expect(board.autoTransferHours).toBe(24)
    const m1 = board.machines.find(m => m.number === 1)!
    // Ishchi boshqa ishchi nomidan yoza olmaydi — o'zi yoziladi
    expect(m1.loads).toEqual([expect.objectContaining({ kg: 10, gramsPerSock: 25, socks: 400, workerName: w.worker.name })])
    expect(board.machines.filter(m => m.loads.length > 0)).toHaveLength(3)

    asUser(w.manager)
    let overview = await getStockOverview()
    expect(overview).toMatchObject({ finishedKg: 0, knitting: { kg: 30, socks: 1200, machines: 3 } })

    // 23 soatdan keyin hali tikilmoqda, 24 soatdan keyin — omborda
    at("2026-10-23T04:00:00Z")
    expect((await getStockOverview()).finishedKg).toBe(0)
    at("2026-10-23T05:00:00Z")
    overview = await getStockOverview()
    expect(overview).toMatchObject({ finishedKg: 30, finishedSocks: 1200, knitting: { kg: 0, machines: 0 } })
    expect(overview.batches).toEqual([expect.objectContaining({ label: "22.10 · Supreme — Qora · 25 g", finishedKg: 30, producedKg: 30 })])
    // Qayta chaqirish ikki marta qo'shmaydi
    expect((await getStockOverview()).finishedKg).toBe(30)
    expect(await prisma.batchMovement.count({ where: { type: 'PRODUCED' } })).toBe(3)

    // Brak: qadoqlashda 2 kg
    const batchId = overview.batches[0].id
    expect(await markDefect(form({ batchId, kg: 2 }))).toEqual({})
    expect((await markDefect(form({ batchId, kg: 100 }))).error).toMatch(/buncha tayyor paypoq yo'q/)
    overview = await getStockOverview()
    expect(overview).toMatchObject({ finishedKg: 28, defectKg: 2 })

    // Hisobot: kuni bo'yicha
    const report = await getMachineReport({ from: "2026-10-22", to: "2026-10-22" })
    expect(report.rows.find(r => r.machineNumber === 1)).toMatchObject({ kg: 10, socks: 400, gramsPerSock: 25, knitting: false })
    expect(report.totals).toEqual({ kg: 30, socks: 1200 })
    expect(report.machines).toBe(3)

    // Tabelda: ip qo'ygan ishchiga 1200 dona
    const rows = await buildTimesheet(w.org.id, { from: "2026-10-22", to: "2026-10-22" })
    expect(rows.find(r => r.userId === w.worker.id)!.pieces).toBe(1200)
  })

  it("bir kunda bir xil ip va gramm — bitta partiya; gramm boshqa — boshqa partiya", async () => {
    asUser(w.manager)
    await loadMachines(form({ machines: "1", yarnId: yarn, gramsPerSock: 25, kgPerMachine: 5 }))
    at("2026-10-22T12:00:00Z")
    await loadMachines(form({ machines: "2", yarnId: yarn, gramsPerSock: 25, kgPerMachine: 5 }))
    await loadMachines(form({ machines: "3", yarnId: yarn, gramsPerSock: 20, kgPerMachine: 4 }))
    at("2026-10-24T00:00:00Z")
    const { batches } = await getStockOverview()
    expect(batches.map(b => [b.label, b.finishedKg, b.finishedSocks]).sort()).toEqual([
      ["22.10 · Supreme — Qora · 20 g", 4, 200],
      ["22.10 · Supreme — Qora · 25 g", 10, 400],
    ])
  })

  it("muddatidan oldin omborga o'tkazish va bekor qilish (ip qaytadi)", async () => {
    asUser(w.worker)
    await loadMachines(form({ machines: "5, 6", yarnId: yarn, gramsPerSock: 30, kgPerMachine: 6 }))
    const board = await getMachinesBoard()
    const [l5] = board.machines.find(m => m.number === 5)!.loads
    const [l6] = board.machines.find(m => m.number === 6)!.loads
    expect((await finishLoadNow(l5.id)).error).toMatch(/ruxsat/)

    asUser(w.manager)
    expect(await finishLoadNow(l5.id)).toEqual({})
    expect((await getStockOverview()).finishedKg).toBe(6)
    expect((await cancelLoad(l5.id)).error).toMatch(/allaqachon/)

    expect(await cancelLoad(l6.id)).toEqual({})
    expect(await yarnKg(yarn)).toBe(494)
    // Bekor qilingan hisobotga kirmaydi va keyin ham omborga o'tmaydi
    at("2026-10-25T00:00:00Z")
    expect((await getStockOverview()).finishedKg).toBe(6)
    expect((await getMachineReport({ from: "2026-10-22", to: "2026-10-22" })).totals).toEqual({ kg: 6, socks: 200 })
  })

  it("ombordagi ipdan ortiq qo'yib bo'lmaydi; ip emas mahsulot va katta gramm rad etiladi", async () => {
    asUser(w.manager)
    expect((await loadMachines(form({ machines: "1-60", yarnId: yarn, gramsPerSock: 25, kgPerMachine: 10 }))).error).toMatch(/yetarli emas/)
    expect(await prisma.machineLoad.count()).toBe(0)
    expect(await yarnKg(yarn)).toBe(500)
    expect((await loadMachines(form({ machines: "1", yarnId: w.sock.id, gramsPerSock: 25, kgPerMachine: 1 }))).error).toMatch(/ip emas/)
    expect((await loadMachines(form({ machines: "1", yarnId: yarn, gramsPerSock: 900, kgPerMachine: 1 }))).error).toMatch(/500/)
  })

  it("omborga o'tish soati sozlanadi (yangi yuklamalar uchun)", async () => {
    asUser(w.manager)
    expect((await updateAutoTransfer(form({ autoTransferHours: 12 }))).error).toMatch(/ruxsat/)
    asUser(w.admin)
    expect((await updateAutoTransfer(form({ autoTransferHours: 0 }))).error).toBeTruthy()
    expect(await updateAutoTransfer(form({ autoTransferHours: 12 }))).toEqual({})
    await loadMachines(form({ machines: "7", yarnId: yarn, gramsPerSock: 25, kgPerMachine: 2 }))
    const load = await prisma.machineLoad.findFirstOrThrow()
    expect(load.readyAt.getTime() - load.loadedAt.getTime()).toBe(12 * HOUR)
  })
})
