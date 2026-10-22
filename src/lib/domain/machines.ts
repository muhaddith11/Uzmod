// Sex hisob-kitobi (bazasiz). Gramm — bitta paypoq (dona) og'irligi.

/** kg ipdan necha dona paypoq chiqadi */
export function socksFromKg(kg: number, gramsPerSock: number): number {
  if (!(gramsPerSock > 0) || !(kg > 0)) return 0
  return Math.floor((kg * 1000) / gramsPerSock)
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

/** Partiya nomi: "22.10 · Supreme — Qora · 25 g" (sana — YYYY-MM-DD) */
export function batchLabel(date: string, yarn: string, gramsPerSock: number): string {
  const [, month, day] = date.split("-")
  return `${day}.${month} · ${yarn} · ${gramsPerSock} g`
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
