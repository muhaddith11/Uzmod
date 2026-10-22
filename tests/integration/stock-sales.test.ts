import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { receiveYarn } from "@/lib/actions/yarn"
import { createMachines, loadMachines } from "@/lib/actions/machines"
import { getStockOverview, markDefect } from "@/lib/actions/batches"
import { cancelStockSale, createStockSale, getSaleOptions, getStockSales } from "@/lib/actions/stock-sales"
import { createExpense } from "@/lib/actions/expenses"
import { repayDebt } from "@/lib/actions/customers"
import { getFinanceSummary } from "@/lib/actions/finance"
import { asUser, form, resetDb, seedWorkshop } from "../helpers"

let w: Awaited<ReturnType<typeof seedWorkshop>>
let yarn: string
let batchId: string

async function yarnKg(productId: string) {
  const agg = await prisma.stockLevel.aggregate({ where: { productId }, _sum: { quantity: true } })
  return agg._sum.quantity ?? 0
}

async function debtOf(name: string) {
  const c = await prisma.customer.findFirstOrThrow({ where: { organizationId: w.org.id, name: { equals: name, mode: 'insensitive' } } })
  return Number(c.debt)
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-10-22T05:00:00Z"))
  await resetDb()
  w = await seedWorkshop()
  asUser(w.admin)
  await createMachines(form({ from: 1, to: 10, group: "A" }))
  await receiveYarn(form({ lines: JSON.stringify([{ type: "Supreme", color: "Qora", kg: 300 }]) }))
  yarn = (await prisma.product.findFirstOrThrow({ where: { organizationId: w.org.id, yarnType: "Supreme" } })).id
  // 10 stanok × 10 kg, 25 g → ertasi kuni 100 kg tayyor paypoq (4 000 dona)
  await loadMachines(form({ machines: "1-10", yarnId: yarn, gramsPerSock: 25, kgPerMachine: 10 }))
  vi.setSystemTime(new Date("2026-10-23T06:00:00Z"))
  const overview = await getStockOverview()
  batchId = overview.batches[0].id
  await markDefect(form({ batchId, kg: 5 }))
})

afterEach(() => {
  vi.useRealTimers()
})

describe("ombordan sotuv", () => {
  it("faqat omborda borlari tanlanadi: tayyor partiya, brak va ip", async () => {
    asUser(w.manager)
    const { items } = await getSaleOptions()
    expect(items.map(i => [i.kind, i.availableKg])).toEqual([["FINISHED", 95], ["DEFECT", 5], ["YARN", 200]])
    expect(items[0].label).toBe("22.10 · Supreme — Qora · 25 g")
  })

  it("partiyadan kg sotiladi, to'lanmagani xaridor nasiyasiga; keyin qarz to'lanadi", async () => {
    asUser(w.manager)
    expect(await createStockSale(form({
      item: `FINISHED:${batchId}`, kg: 40, total: 2_000_000, paid: 1_500_000, customerName: "Ali aka", customerPhone: "+998901112233",
    }))).toEqual({})
    // Mavjud xaridor — ism bo'yicha (katta-kichik harfsiz)
    expect(await createStockSale(form({ item: `DEFECT:${batchId}`, kg: 5, total: 100_000, paid: 0, customerName: "ali AKA" }))).toEqual({})
    expect(await createStockSale(form({ item: `YARN:${yarn}`, kg: 50, total: 1_000_000 }))).toEqual({})

    const overview = await getStockOverview()
    expect(overview).toMatchObject({ finishedKg: 55, defectKg: 0, yarnKg: 150 })
    expect(await debtOf("Ali aka")).toBe(600_000)
    expect(await prisma.customer.count({ where: { organizationId: w.org.id } })).toBe(1)

    const sales = await getStockSales({ from: "2026-10-23", to: "2026-10-23" })
    expect(sales.totals).toEqual({ kg: 95, total: 3_100_000, paid: 2_500_000, debt: 600_000 })
    expect(sales.rows.find(r => r.kind === 'FINISHED')).toMatchObject({ kg: 40, socks: 1600, debt: 500_000, customerName: "Ali aka" })

    const customer = await prisma.customer.findFirstOrThrow({ where: { organizationId: w.org.id } })
    expect((await repayDebt(form({ customerId: customer.id, amount: 700_000 }))).error).toMatch(/qarzdan katta/)
    expect(await repayDebt(form({ customerId: customer.id, amount: 400_000 }))).toEqual({})
    expect(await debtOf("Ali aka")).toBe(200_000)
  })

  it("ortiqcha kg, nasiyada xaridorsiz va ortiqcha to'lov rad etiladi; ishchi sota olmaydi", async () => {
    asUser(w.manager)
    expect((await createStockSale(form({ item: `FINISHED:${batchId}`, kg: 96, total: 1000 }))).error).toMatch(/yetarli emas/)
    expect((await createStockSale(form({ item: `YARN:${yarn}`, kg: 201, total: 1000 }))).error).toMatch(/yetarli emas/)
    expect((await createStockSale(form({ item: `FINISHED:${batchId}`, kg: 1, total: 1000, paid: 500 }))).error).toMatch(/xaridor ismini/)
    expect((await createStockSale(form({ item: `FINISHED:${batchId}`, kg: 1, total: 1000, paid: 1500 }))).error).toMatch(/oshmasin/)
    expect((await createStockSale(form({ item: `FINISHED:nope`, kg: 1, total: 1000 }))).error).toMatch(/topilmadi/)
    asUser(w.worker)
    expect((await createStockSale(form({ item: `FINISHED:${batchId}`, kg: 1, total: 1000 }))).error).toMatch(/ruxsat/)
    expect(await prisma.stockSale.count()).toBe(0)
  })

  it("bekor qilish: faqat admin, kg qaytadi, nasiya kamayadi", async () => {
    asUser(w.manager)
    await createStockSale(form({ item: `FINISHED:${batchId}`, kg: 20, total: 1_000_000, paid: 400_000, customerName: "Vali" }))
    await createStockSale(form({ item: `YARN:${yarn}`, kg: 10, total: 200_000 }))
    const [yarnSale, batchSale] = (await getStockSales({ from: "2026-10-23", to: "2026-10-23" })).rows
    expect((await cancelStockSale(batchSale.id)).error).toMatch(/ruxsat/)

    asUser(w.admin)
    expect(await cancelStockSale(batchSale.id)).toEqual({})
    expect(await cancelStockSale(yarnSale.id)).toEqual({})
    expect(await debtOf("Vali")).toBe(0)
    expect(await yarnKg(yarn)).toBe(200)
    expect((await getStockOverview()).finishedKg).toBe(95)
    expect(await prisma.stockSale.count()).toBe(0)
  })
})

describe("moliya", () => {
  it("sotuv, kassaga tushgan, xarajatlar turi bo'yicha, qoldiq va qarzdorlar", async () => {
    asUser(w.manager)
    await createStockSale(form({ item: `FINISHED:${batchId}`, kg: 30, total: 1_500_000, paid: 1_000_000, customerName: "Ali" }))
    const customer = await prisma.customer.findFirstOrThrow({ where: { organizationId: w.org.id } })
    await repayDebt(form({ customerId: customer.id, amount: 200_000 }))

    asUser(w.admin)
    expect((await createExpense(form({ amount: 1000, category: "Ijara" }))).error).toBeTruthy()
    expect(await createExpense(form({ amount: 300_000, category: "WORKSHOP", note: "Svet" }))).toEqual({})
    expect(await createExpense(form({ amount: 500_000, category: "SALARY", employeeId: w.worker.id }))).toEqual({})
    expect(await createExpense(form({ amount: 100_000, category: "YARN" }))).toEqual({})

    const f = await getFinanceSummary({ from: "2026-10-01", to: "2026-10-31" })
    expect(f).toMatchObject({
      salesTotal: 1_500_000, salesCount: 1, soldKg: 30,
      cashIn: 1_200_000, repaid: 200_000,
      expensesTotal: 900_000, balance: 300_000,
      totalDebt: 300_000,
    })
    expect(f.byCategory).toEqual([
      { category: "WORKSHOP", amount: 300_000 },
      { category: "SALARY", amount: 500_000 },
      { category: "YARN", amount: 100_000 },
      { category: "OTHER", amount: 0 },
    ])
    expect(f.expenses.find(e => e.category === "SALARY")!.employeeName).toBe(w.worker.name)
    expect(f.debtors).toEqual([expect.objectContaining({ name: "Ali", debt: 300_000 })])

    asUser(w.manager)
    await expect(getFinanceSummary({ from: "2026-10-01", to: "2026-10-31" })).rejects.toThrow()
  })
})
