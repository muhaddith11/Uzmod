// Stanok hisob-kitobi (bazasiz). Gramm — bitta paypoq (dona) og'irligi; sanash — juftda.

const round1 = (n: number) => Math.round(n * 10) / 10

/** kg ipdan necha dona paypoq chiqadi */
export function socksFromKg(kg: number, gramsPerSock: number): number {
  if (!(gramsPerSock > 0) || !(kg > 0)) return 0
  return Math.floor((kg * 1000) / gramsPerSock)
}

/** kg ipdan necha juft paypoq chiqadi */
export function pairsFromKg(kg: number, gramsPerSock: number): number {
  return Math.floor(socksFromKg(kg, gramsPerSock) / 2)
}

/** Bir juft uchun ip, kg */
export function kgPerPair(gramsPerSock: number): number {
  return (gramsPerSock * 2) / 1000
}

export type RunNumbers = {
  issuedKg: number
  countedPairs: number
  leftoverKg: number | null
  gramsPerSock: number
}

/**
 * Stanok ishi natijasi. Ochiq ishda sarf = berilgan ip (stanokdagi qoldiq hali
 * noma'lum), yopilganda — berilgan minus qaytarilgan. Farq manfiy bo'lsa — ip
 * kutilganidan ko'p ketgan (brak, chiqindi yoki gramm noto'g'ri qo'yilgan).
 */
export function evaluateRun(run: RunNumbers) {
  const consumedKg = Math.max(run.issuedKg - (run.leftoverKg ?? 0), 0)
  const expectedPairs = pairsFromKg(consumedKg, run.gramsPerSock)
  const usedByCountedKg = run.countedPairs * kgPerPair(run.gramsPerSock)
  const lossKg = Math.max(consumedKg - usedByCountedKg, 0)
  return {
    consumedKg: round1(consumedKg),
    expectedPairs,
    differencePairs: run.countedPairs - expectedPairs,
    efficiencyPercent: expectedPairs > 0 ? Math.round((run.countedPairs / expectedPairs) * 100) : null,
    lossKg: round1(lossKg),
  }
}

/**
 * "1-10, 15, 20-22" → [1..10, 15, 20, 21, 22]. Noto'g'ri qism bo'lsa — null.
 * Bir martada 300 tadan ortiq raqam qabul qilinmaydi.
 */
export function parseMachineNumbers(input: string): number[] | null {
  const result = new Set<number>()
  const parts = input.split(/[,;\s]+/).filter(Boolean)
  if (parts.length === 0) return null
  for (const part of parts) {
    const range = /^(\d+)\s*[-–]\s*(\d+)$/.exec(part)
    if (range) {
      const a = Number(range[1])
      const b = Number(range[2])
      if (a < 1 || b < a || b - a > 300) return null
      for (let n = a; n <= b; n++) result.add(n)
    } else if (/^\d+$/.test(part)) {
      const n = Number(part)
      if (n < 1) return null
      result.add(n)
    } else {
      return null
    }
    if (result.size > 300) return null
  }
  return [...result].sort((x, y) => x - y)
}

/** Ip nomi: "Supreme — Qora" */
export function yarnName(type: string, color: string): string {
  return `${type.trim()} — ${color.trim()}`
}

// Rang nomidan ko'rinadigan nuqta rangi (taxminiy; topilmasa — kulrang)
const COLOR_HINTS: [RegExp, string][] = [
  [/qora|чёрн|черн|black/i, "#111827"],
  [/oq|бел|white/i, "#f9fafb"],
  [/kulrang|сер|gr[ae]y/i, "#9ca3af"],
  [/ko'k|kok|син|blue/i, "#2563eb"],
  [/havorang|голуб|sky/i, "#38bdf8"],
  [/qizil|красн|red/i, "#dc2626"],
  [/yashil|зел|green/i, "#16a34a"],
  [/sariq|жёлт|желт|yellow/i, "#facc15"],
  [/jigarrang|корич|brown/i, "#92400e"],
  [/pushti|роз|pink/i, "#f472b6"],
  [/bej|беж|beige/i, "#e7d7b9"],
]

export function colorHex(color: string | null | undefined): string {
  if (!color) return "#d1d5db"
  return COLOR_HINTS.find(([re]) => re.test(color))?.[1] ?? "#d1d5db"
}
