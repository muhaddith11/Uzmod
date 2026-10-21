import { startOfDay, endOfDay } from "date-fns"

export type DateRangeParams = { from?: string; to?: string }

/**
 * URL query'dan kelgan from/to (YYYY-MM-DD) ni Prisma createdAt filtriga o'giradi.
 * Ikkalasi ham bo'sh bo'lsa undefined qaytaradi — ya'ni butun davr.
 * `to` shu kunning oxirigacha (23:59:59) qamraladi.
 */
export function parseDateRange({ from, to }: DateRangeParams): { gte?: Date; lte?: Date } | undefined {
  const filter: { gte?: Date; lte?: Date } = {}

  if (from) {
    const d = new Date(from)
    if (!isNaN(d.getTime())) filter.gte = startOfDay(d)
  }
  if (to) {
    const d = new Date(to)
    if (!isNaN(d.getTime())) filter.lte = endOfDay(d)
  }

  if (filter.gte === undefined && filter.lte === undefined) return undefined
  return filter
}
