import { describe, expect, it } from "vitest"
import { z } from "zod"
import { computeFinancials } from "@/lib/domain/financials"
import { addDays, lastTashkentDays, parseDateRange, startOfTashkentDay, tashkentDateKey } from "@/lib/tz"
import { fields, parseInput } from "@/lib/validation"
import { ActionError } from "@/lib/action"
import { messages } from "@/i18n/messages"

const base = {
  saleItems: [],
  salesPaid: 0,
  debtPayments: 0,
  expenses: [],
  adjustmentsTotal: 0,
  production: [],
  purchases: [],
  supplierPayments: 0,
  inventory: [],
  customerDebt: 0,
  supplierDebt: 0,
  bonusCategoryLabel: "Bonus",
}

describe("computeFinancials", () => {
  it("ishbay haqni ikki marta ayirmaydi", () => {
    // 10 juft sotildi: narx 12 000, tannarx 2 500 (shundan 800 — ishbay haq).
    // Davrda 20 juft tikildi — hisoblangan ishbay haq 16 000, lekin u foydadan alohida ayirilmaydi.
    const r = computeFinancials({
      ...base,
      saleItems: [{ price: 12000, costPrice: 2500, quantity: 10 }],
      expenses: [{ category: "Ijara", amount: 30000 }],
      adjustmentsTotal: 5000,
      production: [{ quantity: 20, unitWage: 800 }],
    })
    expect(r.revenue).toBe(120000)
    expect(r.cogs).toBe(25000)
    expect(r.grossProfit).toBe(95000)
    expect(r.accruedWages).toBe(16000)
    expect(r.netProfit).toBe(95000 - 30000 - 5000)
  })

  it("pul oqimi va ombor qiymati", () => {
    const r = computeFinancials({
      ...base,
      salesPaid: 70000,
      debtPayments: 20000,
      purchases: [{ quantity: 10, unitCost: 28000 }],
      inventory: [{ quantity: 5, costPrice: 1000 }, { quantity: -2, costPrice: 1000 }],
    })
    expect(r.cashIn).toBe(90000)
    expect(r.purchases).toBe(280000)
    // Manfiy qoldiq ombor qiymatini kamaytirmaydi
    expect(r.inventoryValue).toBe(5000)
  })
})

describe("Toshkent vaqti", () => {
  it("UTC 20:00 — Toshkentda ertasi kun", () => {
    expect(tashkentDateKey(new Date("2026-10-21T20:00:00Z"))).toBe("2026-10-22")
    expect(tashkentDateKey(new Date("2026-10-21T18:59:00Z"))).toBe("2026-10-21")
  })

  it("sana oralig'i Toshkent kunlari bo'yicha", () => {
    const range = parseDateRange({ from: "2026-10-01", to: "2026-10-31" })!
    expect(range.gte?.toISOString()).toBe("2026-09-30T19:00:00.000Z")
    expect(range.lt?.toISOString()).toBe("2026-10-31T19:00:00.000Z")
    expect(parseDateRange({ from: "abc" })).toBeUndefined()
  })

  it("oxirgi 7 kun bugun bilan tugaydi", () => {
    const now = new Date("2026-10-21T21:30:00Z") // Toshkentda 22-oktabr, 02:30
    const days = lastTashkentDays(7, now)
    expect(days).toHaveLength(7)
    expect(days[6].toISOString()).toBe(startOfTashkentDay("2026-10-22").toISOString())
    expect(addDays(days[0], 6).toISOString()).toBe(days[6].toISOString())
  })
})

describe("validatsiya", () => {
  const f = fields(messages.uz)

  it("vergulli kasr va bo'sh joyli sonni qabul qiladi", () => {
    expect(parseInput(f.positive("Miqdor"), "1 000,5")).toBe(1000.5)
  })

  it("maydon nomi bilan xato beradi", () => {
    expect(() => parseInput(f.positive("Miqdor"), "0")).toThrow(ActionError)
    expect(() => parseInput(f.positive("Miqdor"), "0")).toThrow("Miqdor: 0 dan katta bo'lishi kerak")
    expect(() => parseInput(f.positive("Miqdor"), "")).toThrow("Miqdor: son kiriting")
  })

  it("ixtiyoriy matn bo'sh bo'lsa undefined", () => {
    expect(parseInput(z.object({ note: f.optionalText("Izoh") }), { note: "  " })).toEqual({ note: undefined })
  })

  it("email kichik harfga o'giriladi va tekshiriladi", () => {
    expect(parseInput(f.email(), " Admin@Test.UZ ")).toBe("admin@test.uz")
    expect(() => parseInput(f.email(), "nope")).toThrow(messages.uz.validation.email)
  })

  it("ruscha xabarlar ham to'liq", () => {
    expect(messages.ru.validation.positive("Количество")).toContain("больше 0")
  })
})
