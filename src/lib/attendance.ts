import type { Attendance, Organization, Role } from "@prisma/client"
import { socksFromKg } from "@/lib/domain/machines"
import { prisma } from "@/lib/prisma"
import { parseDateRange, tashkentDateKey, type DateRangeParams } from "@/lib/tz"
import { parseWorkDays, summarizeAttendance, type DayRecord, type Schedule } from "@/lib/domain/attendance"

// Davomat uchun server yordamchilari (server action fayli emas — tashqaridan chaqirilmaydi)

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export type Geofence = { lat: number; lng: number; radius: number }

export function scheduleOf(org: Pick<Organization, "workStartTime" | "workEndTime" | "lateGraceMinutes" | "workDays">): Schedule {
  return {
    workStartTime: org.workStartTime,
    workEndTime: org.workEndTime,
    lateGraceMinutes: org.lateGraceMinutes,
    workDays: parseWorkDays(org.workDays),
  }
}

export function geofenceOf(org: Pick<Organization, "geoLat" | "geoLng" | "geoRadiusM">): Geofence | null {
  if (org.geoLat === null || org.geoLng === null || !org.geoRadiusM) return null
  return { lat: org.geoLat, lng: org.geoLng, radius: org.geoRadiusM }
}

export function toDayRecord(a: Pick<Attendance, "date" | "status" | "checkIn" | "checkOut">): DayRecord {
  return { date: a.date, status: a.status, checkIn: a.checkIn, checkOut: a.checkOut }
}

/** Tabel oralig'i: berilmasa — shu oy (1-sanadan bugungacha), Toshkent kunlari */
export function resolveRange(params: DateRangeParams, now = new Date()): { from: string; to: string } {
  const today = tashkentDateKey(now)
  const from = params.from && DATE_KEY.test(params.from) ? params.from : `${today.slice(0, 8)}01`
  const to = params.to && DATE_KEY.test(params.to) ? params.to : today
  return from <= to ? { from, to } : { from: to, to: from }
}

// Davomat yuritiladigan xodimlar: ishchilar va menejerlar (admin — egasi, hisobga olinmaydi)
export const TRACKED_ROLES: Role[] = ["WORKER", "MANAGER"]

export type TimesheetRow = {
  userId: string
  name: string
  email: string
  role: Role
  isActive: boolean
  summary: ReturnType<typeof summarizeAttendance>
  pieces: number
  piecesPerHour: number | null
}

/**
 * Davr bo'yicha tabel: har bir xodim uchun davomat xulosasi va shu davrda tikkan
 * mahsuloti (soatiga unumdorlik). Bloklangan xodimlar ham ko'rsatiladi, agar
 * davrda yozuvi bo'lsa.
 */
export async function buildTimesheet(organizationId: string, range: { from: string; to: string }, now = new Date()): Promise<TimesheetRow[]> {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
  const schedule = scheduleOf(org)
  const createdAt = parseDateRange(range)

  const [users, records, production, loads] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId, role: { in: TRACKED_ROLES } },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prisma.attendance.findMany({
      where: { organizationId, date: { gte: range.from, lte: range.to } },
      select: { userId: true, date: true, status: true, checkIn: true, checkOut: true },
    }),
    prisma.stockMovement.groupBy({
      by: ["workerId"],
      where: { organizationId, type: "PRODUCTION", quantity: { gt: 0 }, workerId: { not: null }, ...(createdAt ? { createdAt } : {}) },
      _sum: { quantity: true },
    }),
    // Stanokka ip qo'ygan xodim — undan chiqadigan paypoq (dona) unga yoziladi
    prisma.machineLoad.findMany({
      where: { organizationId, status: { not: "CANCELLED" }, workerId: { not: null }, ...(createdAt ? { loadedAt: createdAt } : {}) },
      select: { workerId: true, kg: true, gramsPerSock: true },
    }),
  ])

  const recordsByUser = new Map<string, DayRecord[]>()
  for (const r of records) {
    const list = recordsByUser.get(r.userId) ?? []
    list.push(toDayRecord(r))
    recordsByUser.set(r.userId, list)
  }
  const piecesByUser = new Map(production.map(p => [p.workerId as string, p._sum.quantity ?? 0]))
  for (const l of loads) {
    const id = l.workerId as string
    piecesByUser.set(id, (piecesByUser.get(id) ?? 0) + socksFromKg(l.kg, l.gramsPerSock))
  }

  return users
    .filter(u => u.isActive || recordsByUser.has(u.id))
    .map(u => {
      const summary = summarizeAttendance({
        records: recordsByUser.get(u.id) ?? [],
        schedule,
        fromKey: range.from,
        toKey: range.to,
        now,
        employedSinceKey: tashkentDateKey(u.createdAt),
      })
      const pieces = piecesByUser.get(u.id) ?? 0
      const hours = summary.workedMinutes / 60
      return {
        userId: u.id,
        name: u.name ?? u.email,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        summary,
        pieces,
        piecesPerHour: hours >= 0.5 && pieces > 0 ? Math.round((pieces / hours) * 10) / 10 : null,
      }
    })
}
