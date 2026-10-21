// Kun chegaralari O'zbekiston vaqtida (UTC+5). Mamlakatda yozgi vaqt yo'q,
// shuning uchun doimiy siljish yetarli va kutubxonasiz aniq ishlaydi.
const OFFSET_MS = 5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** Toshkent vaqtidagi sana qismi: YYYY-MM-DD */
export function tashkentDateKey(date: Date): string {
  return new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 10)
}

/** YYYY-MM-DD kunining Toshkentdagi boshlanishi (UTC Date sifatida) */
export function startOfTashkentDay(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000+05:00`)
}

/** Berilgan vaqt Toshkentda qaysi kunga tushsa, o'sha kunning boshlanishi */
export function startOfTashkentDayFor(date: Date): Date {
  return startOfTashkentDay(tashkentDateKey(date))
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

/** Oxirgi `count` kunning (bugun ham kiradi) Toshkentdagi boshlanishlari, eskisidan */
export function lastTashkentDays(count: number, now = new Date()): Date[] {
  const today = startOfTashkentDayFor(now)
  return Array.from({ length: count }, (_, i) => addDays(today, i - (count - 1)))
}

export type DateRangeParams = { from?: string; to?: string }

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

/**
 * URL'dagi from/to (YYYY-MM-DD) ni Prisma createdAt filtriga o'giradi — Toshkent
 * kuni bo'yicha. `to` kuni oxirigacha kiradi. Ikkalasi bo'sh bo'lsa — undefined.
 */
export function parseDateRange({ from, to }: DateRangeParams): { gte?: Date; lt?: Date } | undefined {
  const filter: { gte?: Date; lt?: Date } = {}
  if (from && DATE_KEY.test(from)) filter.gte = startOfTashkentDay(from)
  if (to && DATE_KEY.test(to)) filter.lt = addDays(startOfTashkentDay(to), 1)
  if (filter.gte === undefined && filter.lt === undefined) return undefined
  return filter
}
