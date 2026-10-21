import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/prisma"
import { stockIn, stockAdjust, transferStock } from "@/lib/actions/stock"
import { createRolls, finishRoll, transferRolls } from "@/lib/actions/rolls"
import { produceProduct } from "@/lib/actions/production"
import { asUser, costOf, form, resetDb, seedWorkshop, stockOf } from "../helpers"

let w: Awaited<ReturnType<typeof seedWorkshop>>

async function rollsOf(productId: string) {
  const rolls = await prisma.roll.findMany({ where: { productId } })
  // [10 kg'li, 5 kg'li] — bir partiyada yaratilgani uchun vaqt bo'yicha tartiblab bo'lmaydi
  return [...rolls].sort((x, y) => y.initialWeight - x.initialWeight)
}

beforeEach(async () => {
  await resetDb()
  w = await seedWorkshop()
  asUser(w.manager)
  // Rezinka: 100 m × 500 va 100 m × 700 → o'rtacha 600
  expect(await stockIn(form({ productId: w.elastic.id, warehouseId: w.rawWh.id, quantity: 100, unitPrice: 500 }))).toEqual({})
  expect(await stockIn(form({ productId: w.elastic.id, warehouseId: w.rawWh.id, quantity: 100, unitPrice: 700 }))).toEqual({})
  // Ip: ikki rulon 10 kg va 5 kg, 28 000 so'm/kg
  expect(await createRolls(form({ productId: w.yarn.id, warehouseId: w.rawWh.id, weights: "10, 5", unitPrice: 28000 }))).toEqual({})
})

describe("kirim va o'rtacha tannarx", () => {
  it("kirim narxidan o'rtacha tortilgan tannarx", async () => {
    expect(await costOf(w.elastic.id)).toBe(600)
    expect(await stockOf(w.elastic.id, w.rawWh.id)).toBe(200)
    expect(await costOf(w.yarn.id)).toBe(28000)
    expect(await stockOf(w.yarn.id, w.rawWh.id)).toBe(15)
  })

  it("rulonli xomashyoni oddiy kirim/taftish bilan o'zgartirib bo'lmaydi", async () => {
    const r1 = await stockIn(form({ productId: w.yarn.id, warehouseId: w.rawWh.id, quantity: 5, unitPrice: 1 }))
    expect(r1.error).toMatch(/Rulonlar/)
    const r2 = await stockAdjust(form({ productId: w.yarn.id, warehouseId: w.rawWh.id, type: "REVISION", quantity: 100, note: "x" }))
    expect(r2.error).toMatch(/rulon/i)
    expect(await stockOf(w.yarn.id, w.rawWh.id)).toBe(15)
  })

  it("rulonsiz mahsulotga rulon yaratib bo'lmaydi", async () => {
    const r = await createRolls(form({ productId: w.elastic.id, warehouseId: w.rawWh.id, weights: "3", unitPrice: 1 }))
    expect(r.error).toBeTruthy()
    expect(await prisma.roll.count({ where: { productId: w.elastic.id } })).toBe(0)
  })

  it("ishchi rulon qabul qila oladi, lekin narx ta'sir qilmaydi", async () => {
    asUser(w.worker)
    expect(await createRolls(form({ productId: w.yarn.id, warehouseId: w.rawWh.id, weights: "4", unitPrice: 1 }))).toEqual({})
    expect(await costOf(w.yarn.id)).toBe(28000)
    expect(await stockOf(w.yarn.id, w.rawWh.id)).toBe(19)
  })
})

describe("ishlab chiqarish", () => {
  it("xomashyoni FIFO bilan ayiradi va tannarx + ishbay haqni yozadi", async () => {
    const [big, small] = await rollsOf(w.yarn.id)
    asUser(w.worker)
    // Ishchi boshqa ishchi nomidan yozishga urinsa ham — o'z nomidan yoziladi
    const r = await produceProduct(form({
      productId: w.sock.id, fromWarehouseId: w.rawWh.id, toWarehouseId: w.goodsWh.id,
      quantityProduced: 120, workerId: w.worker2.id, [`rollId_${w.yarn.id}`]: small.id,
    }))
    expect(r).toEqual({})

    // 120 × 0.05 = 6 kg: avval tanlangan 5 kg'li rulon tugaydi, so'ng 10 kg'lidan 1 kg
    const [bigAfter, smallAfter] = await rollsOf(w.yarn.id)
    expect(smallAfter).toMatchObject({ currentWeight: 0, status: "FINISHED" })
    expect(bigAfter).toMatchObject({ id: big.id, currentWeight: 9, status: "IN_USE" })
    expect(await stockOf(w.yarn.id, w.rawWh.id)).toBe(9)
    expect(await stockOf(w.elastic.id, w.rawWh.id)).toBe(140)
    expect(await stockOf(w.sock.id, w.goodsWh.id)).toBe(120)

    // 0.05 × 28 000 + 0.5 × 600 + 800 = 2 500
    expect(await costOf(w.sock.id)).toBe(2500)
    const produced = await prisma.stockMovement.findFirstOrThrow({ where: { productId: w.sock.id, type: "PRODUCTION" } })
    expect(produced.workerId).toBe(w.worker.id)
    expect(produced.creatorId).toBe(w.worker.id)
    expect(Number(produced.unitWage)).toBe(800)
    expect(Number(produced.unitCost)).toBe(2500)
  })

  it("xomashyo yetmasa hech narsa o'zgarmaydi", async () => {
    const [, small] = await rollsOf(w.yarn.id)
    const r = await produceProduct(form({
      productId: w.sock.id, fromWarehouseId: w.rawWh.id, toWarehouseId: w.goodsWh.id,
      quantityProduced: 1000, workerId: w.worker.id, [`rollId_${w.yarn.id}`]: small.id,
    }))
    expect(r.error).toMatch(/yetarli emas/)
    expect(await stockOf(w.elastic.id, w.rawWh.id)).toBe(200)
    expect(await stockOf(w.yarn.id, w.rawWh.id)).toBe(15)
    expect(await prisma.stockMovement.count({ where: { type: "PRODUCTION" } })).toBe(0)
  })

  it("rulon tanlanmasa xato", async () => {
    const r = await produceProduct(form({
      productId: w.sock.id, fromWarehouseId: w.rawWh.id, toWarehouseId: w.goodsWh.id, quantityProduced: 1, workerId: w.worker.id,
    }))
    expect(r.error).toMatch(/rulonni tanlang/)
  })
})

describe("taftish, brak, ko'chirish va rulonni yopish", () => {
  it("noto'g'ri amal turi va manfiy taftish rad etiladi", async () => {
    const fake = await stockAdjust(form({ productId: w.elastic.id, warehouseId: w.rawWh.id, type: "PRODUCTION", quantity: 50, note: "x" }))
    expect(fake.error).toBeTruthy()
    const negative = await stockAdjust(form({ productId: w.elastic.id, warehouseId: w.rawWh.id, type: "REVISION", quantity: -5, note: "x" }))
    expect(negative.error).toMatch(/manfiy/)
    expect(await stockOf(w.elastic.id, w.rawWh.id)).toBe(200)
  })

  it("brak va taftish qoldiqni to'g'ri o'zgartiradi", async () => {
    expect(await stockAdjust(form({ productId: w.elastic.id, warehouseId: w.rawWh.id, type: "WASTAGE", quantity: 15, note: "yirtilgan" }))).toEqual({})
    expect(await stockOf(w.elastic.id, w.rawWh.id)).toBe(185)
    expect(await stockAdjust(form({ productId: w.elastic.id, warehouseId: w.rawWh.id, type: "REVISION", quantity: 180, note: "sanoq" }))).toEqual({})
    expect(await stockOf(w.elastic.id, w.rawWh.id)).toBe(180)
    const revision = await prisma.stockMovement.findFirstOrThrow({ where: { type: "REVISION" } })
    expect(revision.quantity).toBe(-5)
  })

  it("omborlar orasida ko'chiradi", async () => {
    expect(await transferStock(form({ productId: w.elastic.id, fromWarehouseId: w.rawWh.id, toWarehouseId: w.goodsWh.id, quantity: 30 }))).toEqual({})
    expect(await stockOf(w.elastic.id, w.rawWh.id)).toBe(170)
    expect(await stockOf(w.elastic.id, w.goodsWh.id)).toBe(30)
    const tooMuch = await transferStock(form({ productId: w.elastic.id, fromWarehouseId: w.rawWh.id, toWarehouseId: w.goodsWh.id, quantity: 1000 }))
    expect(tooMuch.error).toBeTruthy()
  })

  it("rulonlarni ko'chiradi — qoldiq ham birga ko'chadi", async () => {
    const [big] = await rollsOf(w.yarn.id)
    expect(await transferRolls(form({ toWarehouseId: w.goodsWh.id, rollId: [big.id] }))).toEqual({})
    expect(await stockOf(w.yarn.id, w.rawWh.id)).toBe(5)
    expect(await stockOf(w.yarn.id, w.goodsWh.id)).toBe(10)
    expect((await prisma.roll.findUniqueOrThrow({ where: { id: big.id } })).warehouseId).toBe(w.goodsWh.id)
  })

  it("rulonni faqat rahbariyat yopadi", async () => {
    const [big] = await rollsOf(w.yarn.id)
    asUser(w.worker)
    expect((await finishRoll(big.id)).error).toMatch(/ruxsat/)
    asUser(w.manager)
    expect(await finishRoll(big.id)).toEqual({})
    expect(await stockOf(w.yarn.id, w.rawWh.id)).toBe(5)
    expect((await finishRoll(big.id)).error).toMatch(/allaqachon/)
  })
})
