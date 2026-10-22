import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { receiveYarn, getYarnStock } from "@/lib/actions/yarn"
import {
  addYarnToRun, closeRun, createMachines, getMachineReport, getMachinesBoard, recordCount, recordShiftCounts, startRuns,
} from "@/lib/actions/machines"
import { getWorkerEarnings } from "@/lib/actions/workers"
import { asUser, costOf, form, resetDb, seedWorkshop, stockOf } from "../helpers"

let w: Awaited<ReturnType<typeof seedWorkshop>>
let wh: string // bitta ombor — ip ham, paypoq ham shu yerda

const lines = (items: { type: string; color: string; kg: number; price?: number }[]) => JSON.stringify(items)

async function yarnId(type: string, color: string) {
  return (await prisma.product.findFirstOrThrow({ where: { organizationId: w.org.id, yarnType: type, color } })).id
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-10-22T05:00:00Z")) // 10:00 Toshkent
  await resetDb()
  w = await seedWorkshop()
  wh = w.rawWh.id
  // Paypoq ishbay haqi — 1 juft uchun 100 so'm
  await prisma.product.update({ where: { id: w.sock.id }, data: { productionWage: 100 } })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("ip qabul qilish", () => {
  it("tur+rang bo'yicha ip yaratadi, keyingi qabul — o'sha ipga (katta-kichik harf farqsiz)", async () => {
    asUser(w.manager)
    expect(await receiveYarn(form({
      warehouseId: wh,
      lines: lines([
        { type: "Supreme", color: "Qora", kg: 1000, price: 30000 },
        { type: "Supreme", color: "Oq", kg: 800, price: 32000 },
        { type: "X/B", color: "Qora", kg: 1200 },
      ]),
    }))).toEqual({})
    expect(await receiveYarn(form({ warehouseId: wh, lines: lines([{ type: "supreme", color: "qora", kg: 1000, price: 34000 }]) }))).toEqual({})

    const supremeBlack = await yarnId("Supreme", "Qora")
    expect(await stockOf(supremeBlack, wh)).toBe(2000)
    expect(await costOf(supremeBlack)).toBe(32000)
    expect(await prisma.product.count({ where: { organizationId: w.org.id, yarnType: { not: null } } })).toBe(3)

    const stock = await getYarnStock()
    expect(stock.find(s => s.id === supremeBlack)).toMatchObject({ stockKg: 2000, todayKg: 2000, name: "Supreme — Qora" })
  })

  it("bo'sh qator va manfiy og'irlik rad etiladi; ishchi ip qabul qila olmaydi", async () => {
    asUser(w.manager)
    expect((await receiveYarn(form({ warehouseId: wh, lines: "[]" }))).error).toMatch(/Kamida bitta/)
    expect((await receiveYarn(form({ warehouseId: wh, lines: lines([{ type: "S", color: "Q", kg: -5 }]) }))).error).toBeTruthy()
    asUser(w.worker)
    expect((await receiveYarn(form({ warehouseId: wh, lines: lines([{ type: "S", color: "Q", kg: 5 }]) }))).error).toMatch(/ruxsat/)
  })
})

describe("stanoklar", () => {
  beforeEach(async () => {
    asUser(w.admin)
    expect(await createMachines(form({ from: 1, to: 53, group: "A" }))).toEqual({})
    expect(await createMachines(form({ from: 54, to: 99, group: "B" }))).toEqual({})
    asUser(w.manager)
    await receiveYarn(form({ warehouseId: wh, lines: lines([{ type: "Supreme", color: "Qora", kg: 500, price: 30000 }]) }))
  })

  it("99 ta stanok, takroriy raqam rad etiladi", async () => {
    expect(await prisma.machine.count({ where: { organizationId: w.org.id } })).toBe(99)
    asUser(w.admin)
    expect((await createMachines(form({ from: 50, to: 60, group: "C" }))).error).toMatch(/allaqachon/)
  })

  it("to'liq oqim: bir nechta stanokka ip, sanash, ip qo'shish, yakunlash va hisobot", async () => {
    const yarn = await yarnId("Supreme", "Qora")
    asUser(w.worker)
    // Ishchi 1-3 stanoklarga 10 kg dan qo'ydi, 25 g → har biridan 200 juft kutiladi
    expect(await startRuns(form({
      machines: "1-3", yarnId: yarn, productId: w.sock.id, gramsPerSock: 25, kgPerMachine: 10,
      rawWarehouseId: wh, goodsWarehouseId: w.goodsWh.id,
    }))).toEqual({})
    expect(await stockOf(yarn, wh)).toBe(470)

    // Band stanokni qayta yurgizib bo'lmaydi
    expect((await startRuns(form({ machines: "3, 4", yarnId: yarn, productId: w.sock.id, gramsPerSock: 25, kgPerMachine: 1 }))).error).toMatch(/ochiq/)
    expect((await startRuns(form({ machines: "150", yarnId: yarn, productId: w.sock.id, gramsPerSock: 25, kgPerMachine: 1 }))).error).toMatch(/Bunday stanok yo'q/)

    const board = await getMachinesBoard()
    const m1 = board.find(m => m.number === 1)!
    expect(m1.run).toMatchObject({ issuedKg: 10, expectedPairs: 200, gramsPerSock: 25 })
    expect(board.filter(m => m.run)).toHaveLength(3)

    // Ishchi o'zi sanaydi — boshqa ishchi nomidan yozib bo'lmaydi
    expect(await recordCount(form({ runId: m1.run!.id, pairs: 120, workerId: w.worker2.id }))).toEqual({})
    expect(await stockOf(w.sock.id, w.goodsWh.id)).toBe(120)
    // Tannarx: 0.05 kg × 30 000 + 100 = 1 600
    expect(await costOf(w.sock.id)).toBe(1600)

    // Menejer smena oxirida qolganlarini birdan kiritadi
    asUser(w.manager)
    const m2 = board.find(m => m.number === 2)!
    const m3 = board.find(m => m.number === 3)!
    expect(await recordShiftCounts(form({
      [`count_${m2.run!.id}`]: "190", [`worker_${m2.run!.id}`]: w.worker2.id, [`count_${m3.run!.id}`]: "",
    }))).toEqual({})
    expect((await recordShiftCounts(form({ [`count_${m3.run!.id}`]: "" }))).error).toMatch(/kiritilmadi/)

    // 1-stanokka yana 2 kg ip, keyin yakunlash: 1.5 kg qaytdi, oxirgi sanoq 85
    asUser(w.worker)
    expect(await addYarnToRun(form({ runId: m1.run!.id, kg: 2 }))).toEqual({})
    expect((await closeRun(form({ runId: m1.run!.id, leftoverKg: 50 }))).error).toMatch(/ko'p bo'lishi mumkin emas/)
    expect(await closeRun(form({ runId: m1.run!.id, leftoverKg: 1.5, finalPairs: 85 }))).toEqual({})
    expect(await stockOf(yarn, wh)).toBe(470 - 2 + 1.5)
    expect((await recordCount(form({ runId: m1.run!.id, pairs: 1 }))).error).toMatch(/yakunlangan/)

    // Hisobot: 1-stanok — 10.5 kg sarf → 210 juft kutiladi, 205 sanaldi
    asUser(w.manager)
    const report = await getMachineReport({})
    const r1 = report.rows.find(r => r.machineNumber === 1)!
    expect(r1).toMatchObject({ issuedKg: 10.5, countedPairs: 205, expectedPairs: 210, differencePairs: -5, efficiencyPercent: 98 })
    expect(report.totals.countedPairs).toBe(205 + 190)

    // Ishbay haq: ishchi 205 juft, ikkinchi ishchi 190 juft (× 100 so'm)
    const earnings = await getWorkerEarnings({ from: "2026-10-22", to: "2026-10-22" })
    expect(earnings.find(e => e.id === w.worker.id)!.pieceTotal).toBe(20500)
    expect(earnings.find(e => e.id === w.worker2.id)!.pieceTotal).toBe(19000)
  })

  it("ombordagi ipdan ortiq berib bo'lmaydi; ip emas mahsulot tanlab bo'lmaydi", async () => {
    const yarn = await yarnId("Supreme", "Qora")
    asUser(w.manager)
    expect((await startRuns(form({ machines: "1-60", yarnId: yarn, productId: w.sock.id, gramsPerSock: 25, kgPerMachine: 10 }))).error).toMatch(/yetarli emas/)
    expect(await prisma.machineRun.count()).toBe(0)
    expect((await startRuns(form({ machines: "1", yarnId: w.sock.id, productId: w.sock.id, gramsPerSock: 25, kgPerMachine: 1 }))).error).toMatch(/ip emas/)
    expect((await startRuns(form({ machines: "1", yarnId: yarn, productId: w.sock.id, gramsPerSock: 900, kgPerMachine: 1 }))).error).toMatch(/500/)
  })
})
