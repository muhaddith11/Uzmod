import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/prisma"
import { stockIn } from "@/lib/actions/stock"
import { createSale, cancelSale } from "@/lib/actions/sales"
import { repayDebt } from "@/lib/actions/customers"
import { createExpense } from "@/lib/actions/expenses"
import { addAdjustment } from "@/lib/actions/workers"
import { createSupplier, paySupplier } from "@/lib/actions/suppliers"
import { getFinancialSummary } from "@/lib/actions/reports"
import { asUser, costOf, form, resetDb, seedWorkshop, stockOf } from "../helpers"

let w: Awaited<ReturnType<typeof seedWorkshop>>
let customerId: string

beforeEach(async () => {
  await resetDb()
  w = await seedWorkshop()
  asUser(w.manager)
  // Tayyor paypoq va rezinka omborda (tannarx 2 500 va 600)
  await stockIn(form({ productId: w.sock.id, warehouseId: w.goodsWh.id, quantity: 100, unitPrice: 2500 }))
  await stockIn(form({ productId: w.elastic.id, warehouseId: w.goodsWh.id, quantity: 50, unitPrice: 600 }))
  const customer = await prisma.customer.create({ data: { name: "Aziz do'koni", organizationId: w.org.id } })
  customerId = customer.id
})

const items = (lines: { productId: string; quantity: number; price: number }[]) => JSON.stringify(lines)

describe("sotuv", () => {
  it("bir nechta mahsulot, jami serverda hisoblanadi, qarz mijozga yoziladi", async () => {
    const r = await createSale(form({
      warehouseId: w.goodsWh.id, customerId, paymentType: "CASH", paidAmount: 100000,
      items: items([
        { productId: w.sock.id, quantity: 10, price: 12000 },
        { productId: w.elastic.id, quantity: 5, price: 1000 },
      ]),
    }))
    expect(r).toEqual({})

    const sale = await prisma.sale.findFirstOrThrow({ include: { items: true, movements: true } })
    expect(Number(sale.totalAmount)).toBe(125000)
    expect(sale.items).toHaveLength(2)
    expect(sale.movements).toHaveLength(2)
    expect(sale.createdById).toBe(w.manager.id)
    expect(sale.warehouseId).toBe(w.goodsWh.id)
    expect(await stockOf(w.sock.id, w.goodsWh.id)).toBe(90)
    expect(Number((await prisma.customer.findUniqueOrThrow({ where: { id: customerId } })).debt)).toBe(25000)
  })

  it("to'liq to'lanmasa mijoz majburiy; ishchi sota olmaydi; rulonli xomashyo sotilmaydi", async () => {
    const noCustomer = await createSale(form({
      warehouseId: w.goodsWh.id, paymentType: "CASH", paidAmount: 1,
      items: items([{ productId: w.sock.id, quantity: 1, price: 12000 }]),
    }))
    expect(noCustomer.error).toMatch(/mijozni tanlang/)

    const roll = await createSale(form({
      warehouseId: w.goodsWh.id, paymentType: "CASH", paidAmount: 0,
      items: items([{ productId: w.yarn.id, quantity: 1, price: 0 }]),
    }))
    expect(roll.error).toMatch(/rulon/)

    asUser(w.worker)
    const byWorker = await createSale(form({
      warehouseId: w.goodsWh.id, paymentType: "CASH", paidAmount: 12000,
      items: items([{ productId: w.sock.id, quantity: 1, price: 12000 }]),
    }))
    expect(byWorker.error).toMatch(/ruxsat/)
    expect(await prisma.sale.count()).toBe(0)
  })

  it("bekor qilish: faqat admin, mahsulot qaytadi, qarz kamayadi, hisobotdan chiqadi", async () => {
    await createSale(form({
      warehouseId: w.goodsWh.id, customerId, paymentType: "DEBT", paidAmount: 0,
      items: items([{ productId: w.sock.id, quantity: 20, price: 12000 }]),
    }))
    const sale = await prisma.sale.findFirstOrThrow()

    expect((await cancelSale(form({ saleId: sale.id, reason: "qaytardi" }))).error).toMatch(/ruxsat/)

    asUser(w.admin)
    expect(await cancelSale(form({ saleId: sale.id, reason: "qaytardi" }))).toEqual({})
    expect(await stockOf(w.sock.id, w.goodsWh.id)).toBe(100)
    expect(await costOf(w.sock.id)).toBe(2500)
    expect(Number((await prisma.customer.findUniqueOrThrow({ where: { id: customerId } })).debt)).toBe(0)
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } })).status).toBe("CANCELLED")
    expect(await prisma.stockMovement.count({ where: { type: "RETURN", saleId: sale.id } })).toBe(1)

    const report = await getFinancialSummary()
    expect(report.revenue).toBe(0)
    expect((await cancelSale(form({ saleId: sale.id, reason: "yana" }))).error).toMatch(/allaqachon/)
  })

  it("qarzdan ortiq to'lovni qabul qilmaydi", async () => {
    await createSale(form({
      warehouseId: w.goodsWh.id, customerId, paymentType: "DEBT", paidAmount: 0,
      items: items([{ productId: w.sock.id, quantity: 1, price: 12000 }]),
    }))
    expect((await repayDebt(form({ customerId, amount: 20000 }))).error).toMatch(/qarzdan katta/)
    expect(await repayDebt(form({ customerId, amount: 12000 }))).toEqual({})
  })
})

describe("hisobot", () => {
  it("sof foyda: ishbay haq tannarx ichida, ikki marta ayirilmaydi", async () => {
    await createSale(form({
      warehouseId: w.goodsWh.id, customerId, paymentType: "CASH", paidAmount: 100000,
      items: items([{ productId: w.sock.id, quantity: 10, price: 12000 }]),
    }))
    await repayDebt(form({ customerId, amount: 20000 }))
    await addAdjustment(form({ userId: w.worker.id, amount: 5000, type: "BONUS" }))

    asUser(w.admin)
    await createExpense(form({ amount: 30000, category: "Ijara" }))

    const r = await getFinancialSummary()
    expect(r.revenue).toBe(120000)
    expect(r.cogs).toBe(25000)
    expect(r.grossProfit).toBe(95000)
    expect(r.netProfit).toBe(95000 - 30000 - 5000)
    expect(r.cashIn).toBe(120000)
    expect(r.customerDebt).toBe(0)
    // 90 × 2 500 + 50 × 600
    expect(r.inventoryValue).toBe(255000)
  })

  it("ta'minotchi: qarzga xarid, to'lov va qarz", async () => {
    await createSupplier(form({ name: "Ip savdo" }))
    const supplier = await prisma.supplier.findFirstOrThrow()
    expect(await stockIn(form({
      productId: w.elastic.id, warehouseId: w.rawWh.id, quantity: 100, unitPrice: 800, supplierId: supplier.id, paidAmount: 30000,
    }))).toEqual({})
    expect(Number((await prisma.supplier.findUniqueOrThrow({ where: { id: supplier.id } })).debt)).toBe(50000)
    expect((await paySupplier(form({ supplierId: supplier.id, amount: 60000 }))).error).toBeTruthy()
    expect(await paySupplier(form({ supplierId: supplier.id, amount: 50000 }))).toEqual({})

    asUser(w.admin)
    const r = await getFinancialSummary()
    expect(r.supplierDebt).toBe(0)
    expect(r.supplierPayments).toBe(80000)
    // rezinka: 50 × 600 (oldingi) + 100 × 800 → o'rtacha 733.33
    expect(await costOf(w.elastic.id)).toBeCloseTo(733.33, 2)
  })
})
