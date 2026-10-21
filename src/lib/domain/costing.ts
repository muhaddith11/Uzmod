// Tannarx va rulon sarfi bo'yicha sof hisob-kitoblar (bazasiz — test qilish oson)

/** Vazn/miqdor uchun float yig'ilish xatosiga chidamlilik chegarasi */
export const QTY_EPSILON = 0.0001

export function roundQty(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * O'rtacha tortilgan tannarx: omborda `currentQty` birlik `currentCost` narxda turibdi,
 * ustiga `addedQty` birlik `addedCost` narxda qo'shildi. Qoldiq manfiy yoki nol bo'lsa,
 * yangi kirim narxi olinadi.
 */
export function weightedAverageCost(
  currentQty: number,
  currentCost: number,
  addedQty: number,
  addedCost: number,
): number {
  if (addedQty <= 0) return roundMoney(currentCost)
  const existing = Math.max(currentQty, 0)
  if (existing <= QTY_EPSILON) return roundMoney(addedCost)
  return roundMoney((existing * currentCost + addedQty * addedCost) / (existing + addedQty))
}

/** Bir dona tayyor mahsulot tannarxi: resept bo'yicha xomashyo + ishbay haq */
export function productionUnitCost(
  items: { quantityNeeded: number; materialCost: number }[],
  wage: number,
): { material: number; wage: number; total: number } {
  const material = items.reduce((acc, item) => acc + item.quantityNeeded * item.materialCost, 0)
  return {
    material: roundMoney(material),
    wage: roundMoney(wage),
    total: roundMoney(material + wage),
  }
}

export type RollSlice = { id: string; currentWeight: number }
export type RollTake = { rollId: string; take: number; leftover: number; finished: boolean }

/**
 * Rulonlardan navbat bilan (FIFO) sarflash rejasi. Navbatning birinchisi — ishchi
 * tanlagan rulon, qolganlari eskisidan yangisiga. `shortfall` > 0 bo'lsa rulonlar yetmaydi.
 */
export function allocateFromRolls(queue: RollSlice[], needed: number): { takes: RollTake[]; shortfall: number } {
  let remaining = needed
  const takes: RollTake[] = []
  for (const roll of queue) {
    if (remaining <= QTY_EPSILON) break
    if (roll.currentWeight <= 0) continue
    const take = roundQty(Math.min(roll.currentWeight, remaining))
    const leftover = roundQty(roll.currentWeight - take)
    const finished = leftover < QTY_EPSILON
    takes.push({ rollId: roll.id, take, leftover: finished ? 0 : leftover, finished })
    remaining = roundQty(remaining - take)
  }
  return { takes, shortfall: remaining > QTY_EPSILON ? remaining : 0 }
}

/**
 * "25.4, 26.1 24.8" → [25.4, 26.1, 24.8]. Ajratuvchi: vergul, nuqtali vergul yoki
 * bo'sh joy. Biror qiymat son bo'lmasa yoki 0 dan katta bo'lmasa — null.
 */
export function parseRollWeights(input: string): number[] | null {
  const parts = input.split(/[,;\s]+/).filter(part => part.length > 0)
  if (parts.length === 0) return null
  const weights = parts.map(part => Number(part))
  if (weights.some(w => !Number.isFinite(w) || w <= 0)) return null
  return weights.map(roundQty)
}
