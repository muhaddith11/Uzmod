import { describe, expect, it } from "vitest"
import { allocateFromRolls, parseRollWeights, productionUnitCost, weightedAverageCost } from "@/lib/domain/costing"

describe("weightedAverageCost", () => {
  it("o'rtacha tortilgan narxni hisoblaydi", () => {
    expect(weightedAverageCost(100, 500, 100, 700)).toBe(600)
    expect(weightedAverageCost(30, 1000, 10, 2000)).toBe(1250)
  })

  it("qoldiq bo'lmasa yangi kirim narxini oladi", () => {
    expect(weightedAverageCost(0, 999, 10, 300)).toBe(300)
    expect(weightedAverageCost(-5, 999, 10, 300)).toBe(300)
  })

  it("kirim nol bo'lsa narx o'zgarmaydi", () => {
    expect(weightedAverageCost(10, 450, 0, 9999)).toBe(450)
  })
})

describe("productionUnitCost", () => {
  it("xomashyo + ishbay haq", () => {
    const cost = productionUnitCost(
      [{ quantityNeeded: 0.05, materialCost: 28000 }, { quantityNeeded: 0.5, materialCost: 600 }],
      800,
    )
    expect(cost).toEqual({ material: 1700, wage: 800, total: 2500 })
  })
})

describe("allocateFromRolls", () => {
  it("tanlangan rulondan boshlab FIFO bilan sarflaydi", () => {
    const plan = allocateFromRolls([{ id: "a", currentWeight: 3 }, { id: "b", currentWeight: 10 }], 5)
    expect(plan.shortfall).toBe(0)
    expect(plan.takes).toEqual([
      { rollId: "a", take: 3, leftover: 0, finished: true },
      { rollId: "b", take: 2, leftover: 8, finished: false },
    ])
  })

  it("yetmasa shortfall qaytaradi", () => {
    const plan = allocateFromRolls([{ id: "a", currentWeight: 1.2 }], 2)
    expect(plan.shortfall).toBeCloseTo(0.8)
  })

  it("float qoldig'ini to'g'ri tugatadi", () => {
    const plan = allocateFromRolls([{ id: "a", currentWeight: 0.3 }], 0.1 + 0.2)
    expect(plan.takes[0]).toMatchObject({ finished: true, leftover: 0 })
  })
})

describe("parseRollWeights", () => {
  it("vergul va bo'sh joy bilan ajratilgan vaznlar", () => {
    expect(parseRollWeights("25.4, 26.1 24.8")).toEqual([25.4, 26.1, 24.8])
    expect(parseRollWeights("10;5")).toEqual([10, 5])
  })

  it("noto'g'ri qiymatni rad etadi", () => {
    expect(parseRollWeights("10, abc")).toBeNull()
    expect(parseRollWeights("10, 0")).toBeNull()
    expect(parseRollWeights("  ")).toBeNull()
  })
})
