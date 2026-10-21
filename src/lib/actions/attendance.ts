'use server'

import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { AttendanceStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getSessionUser, requireRole, type SessionUser } from "@/lib/session"
import { action, ActionError } from "@/lib/action"
import { fields, parseForm } from "@/lib/validation"
import { tashkentDateKey, type DateRangeParams } from "@/lib/tz"
import { formatNumber } from "@/lib/format"
import {
  atTime, distanceMeters, evaluateDay, isoWeekday, isValidTime, parseTime, summarizeAttendance,
} from "@/lib/domain/attendance"
import { buildTimesheet, geofenceOf, resolveRange, scheduleOf, toDayRecord, TRACKED_ROLES } from "@/lib/attendance"
import { getLocale, getT } from "@/i18n/server"

const STATUSES = ["PRESENT", "SICK", "VACATION", "EXCUSED"] as const
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

function revalidateAttendance() {
  revalidatePath("/")
  revalidatePath("/attendance")
  revalidatePath("/workers")
}

/** Xodimning bugungi holati — kelish/ketish tugmasi uchun (Mini App ham chaqiradi) */
export async function getMyAttendanceToday() {
  const me = await getSessionUser()
  const now = new Date()
  const date = tashkentDateKey(now)
  const [org, record] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: me.organizationId } }),
    prisma.attendance.findUnique({ where: { userId_date: { userId: me.id, date } } }),
  ])
  const schedule = scheduleOf(org)
  const geo = geofenceOf(org)
  return {
    date,
    workStartTime: schedule.workStartTime,
    workEndTime: schedule.workEndTime,
    isWorkday: schedule.workDays.includes(isoWeekday(date)),
    requireLocation: geo !== null,
    radius: geo?.radius ?? null,
    record: record
      ? { status: record.status, checkIn: record.checkIn, checkOut: record.checkOut }
      : null,
    evaluation: record ? evaluateDay(toDayRecord(record), schedule, now) : null,
  }
}

/** Joriy foydalanuvchining shu oydagi xulosasi (bosh sahifa) */
export async function getMyMonthSummary() {
  const me = await getSessionUser()
  const now = new Date()
  const range = resolveRange({}, now)
  const [org, user, records] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: me.organizationId } }),
    prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { createdAt: true } }),
    prisma.attendance.findMany({ where: { userId: me.id, date: { gte: range.from, lte: range.to } } }),
  ])
  return summarizeAttendance({
    records: records.map(toDayRecord),
    schedule: scheduleOf(org),
    fromKey: range.from,
    toKey: range.to,
    now,
    employedSinceKey: tashkentDateKey(user.createdAt),
  })
}

/**
 * Joylashuv tekshiruvi: sex joylashuvi berilgan bo'lsa, koordinata majburiy va
 * radius ichida bo'lishi shart. GPS aniqligi hisobga olinadi, lekin 100 m dan ortiq emas.
 */
async function checkLocation(me: SessionUser, formData: FormData) {
  const t = await getT()
  const locale = await getLocale()
  const f = fields(t)
  const coords = parseForm(z.object({
    lat: f.optionalNumber("lat"),
    lng: f.optionalNumber("lng"),
    accuracy: f.optionalNonNegative("accuracy"),
  }), formData)
  const hasCoords = coords.lat !== undefined && coords.lng !== undefined
    && Math.abs(coords.lat) <= 90 && Math.abs(coords.lng) <= 180

  const org = await prisma.organization.findUniqueOrThrow({ where: { id: me.organizationId } })
  const geo = geofenceOf(org)
  if (!geo) {
    return { lat: hasCoords ? coords.lat! : null, lng: hasCoords ? coords.lng! : null, distance: null }
  }
  if (!hasCoords) throw new ActionError(t.attendance.locationRequired)

  const distance = distanceMeters(geo.lat, geo.lng, coords.lat!, coords.lng!)
  const tolerance = Math.min(coords.accuracy ?? 0, 100)
  if (distance > geo.radius + tolerance) {
    throw new ActionError(t.attendance.tooFar(`${formatNumber(distance, locale, 0)} m`, `${formatNumber(geo.radius, locale, 0)} m`))
  }
  return { lat: coords.lat!, lng: coords.lng!, distance }
}

export const checkIn = action(async function checkIn(formData: FormData) {
  const me = await getSessionUser()
  const t = await getT()
  const location = await checkLocation(me, formData)
  const now = new Date()
  const date = tashkentDateKey(now)

  const existing = await prisma.attendance.findUnique({ where: { userId_date: { userId: me.id, date } } })
  if (existing && existing.status !== 'PRESENT') {
    throw new ActionError(t.attendance.dayMarkedAs(t.attendance.status[existing.status]))
  }
  if (existing?.checkIn) throw new ActionError(t.attendance.alreadyCheckedIn)

  const data = {
    checkIn: now,
    checkInLat: location.lat,
    checkInLng: location.lng,
    checkInDistanceM: location.distance,
  }
  try {
    if (existing) {
      await prisma.attendance.update({ where: { id: existing.id }, data })
    } else {
      await prisma.attendance.create({
        data: { ...data, userId: me.id, date, status: 'PRESENT', source: 'SELF', organizationId: me.organizationId }
      })
    }
  } catch (error) {
    // Ikki marta tez bosilsa — ikkinchisi unique cheklovga uriladi
    if ((error as { code?: string })?.code === 'P2002') throw new ActionError(t.attendance.alreadyCheckedIn)
    throw error
  }
  revalidateAttendance()
})

export const checkOut = action(async function checkOut(formData: FormData) {
  const me = await getSessionUser()
  const t = await getT()
  const location = await checkLocation(me, formData)
  const now = new Date()
  const date = tashkentDateKey(now)

  const existing = await prisma.attendance.findUnique({ where: { userId_date: { userId: me.id, date } } })
  if (!existing?.checkIn) throw new ActionError(t.attendance.notCheckedInYet)
  if (existing.checkOut) throw new ActionError(t.attendance.alreadyCheckedOut)

  // Faqat ochiq yozuv yopiladi — parallel bosishda ikkinchisi hech narsa o'zgartirmaydi
  const { count } = await prisma.attendance.updateMany({
    where: { id: existing.id, checkOut: null },
    data: {
      checkOut: now,
      checkOutLat: location.lat,
      checkOutLng: location.lng,
      checkOutDistanceM: location.distance,
    }
  })
  if (count === 0) throw new ActionError(t.attendance.alreadyCheckedOut)
  revalidateAttendance()
})

export type BoardState = "inWork" | "left" | "absent" | "notYet" | "dayOff" | "SICK" | "VACATION" | "EXCUSED"

/** Bugungi holat: kim ishda, kim kechikdi, kim kelmadi */
export async function getTodayBoard() {
  const { organizationId } = await requireRole('ADMIN', 'MANAGER')
  const now = new Date()
  const date = tashkentDateKey(now)
  const [org, users, records] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    prisma.user.findMany({
      where: { organizationId, isActive: true, role: { in: TRACKED_ROLES } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ role: 'desc' }, { name: 'asc' }],
    }),
    prisma.attendance.findMany({ where: { organizationId, date } }),
  ])
  const schedule = scheduleOf(org)
  const byUser = new Map(records.map(r => [r.userId, r]))
  const isWorkday = schedule.workDays.includes(isoWeekday(date))
  const start = atTime(date, schedule.workStartTime)
  const graceOver = start ? now.getTime() > start.getTime() + schedule.lateGraceMinutes * 60_000 : true

  const rows = users.map(u => {
    const r = byUser.get(u.id)
    const evaluation = r ? evaluateDay(toDayRecord(r), schedule, now) : null
    let state: BoardState
    if (!r) state = !isWorkday ? "dayOff" : graceOver ? "absent" : "notYet"
    else if (r.status !== 'PRESENT') state = r.status
    else if (!r.checkIn) state = graceOver ? "absent" : "notYet"
    else state = r.checkOut ? "left" : "inWork"
    return {
      userId: u.id,
      name: u.name ?? u.email,
      role: u.role,
      state,
      recordId: r?.id ?? null,
      status: r?.status ?? null,
      checkIn: r?.checkIn ?? null,
      checkOut: r?.checkOut ?? null,
      note: r?.note ?? null,
      source: r?.source ?? null,
      distance: r?.checkInDistanceM ?? null,
      workedMinutes: evaluation?.workedMinutes ?? 0,
      lateMinutes: evaluation?.lateMinutes ?? 0,
    }
  })

  return {
    date,
    isWorkday,
    rows,
    counts: {
      inWork: rows.filter(r => r.state === "inWork").length,
      late: rows.filter(r => r.lateMinutes > 0).length,
      absent: rows.filter(r => r.state === "absent").length,
      excused: rows.filter(r => r.state === "SICK" || r.state === "VACATION" || r.state === "EXCUSED").length,
      total: rows.length,
    },
  }
}

export async function getTimesheet(params: DateRangeParams) {
  const { organizationId } = await requireRole('ADMIN', 'MANAGER')
  const range = resolveRange(params)
  return { range, rows: await buildTimesheet(organizationId, range) }
}

export async function getAttendanceRecords(params: DateRangeParams, limit = 300) {
  const { organizationId } = await requireRole('ADMIN', 'MANAGER')
  const range = resolveRange(params)
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
  const schedule = scheduleOf(org)
  const now = new Date()
  const records = await prisma.attendance.findMany({
    where: { organizationId, date: { gte: range.from, lte: range.to } },
    include: {
      user: { select: { name: true, email: true, role: true } },
      editedBy: { select: { name: true, email: true } },
    },
    orderBy: [{ date: 'desc' }, { checkIn: 'asc' }],
    take: limit,
  })
  return records.map(r => {
    const e = evaluateDay(toDayRecord(r), schedule, now)
    return {
      id: r.id,
      userId: r.userId,
      userName: r.user.name ?? r.user.email,
      userRole: r.user.role,
      date: r.date,
      status: r.status,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      source: r.source,
      note: r.note,
      distanceIn: r.checkInDistanceM,
      distanceOut: r.checkOutDistanceM,
      editedByName: r.editedBy?.name ?? r.editedBy?.email ?? null,
      ...e,
    }
  })
}

/**
 * Admin — har qanday xodimni, menejer — faqat ishchini. Menejer o'z davomatini
 * o'zi tuzata olmaydi (manfaatlar to'qnashuvi).
 */
async function findEditableUser(me: SessionUser, userId: string) {
  const t = await getT()
  const target = await prisma.user.findFirst({
    where: { id: userId, organizationId: me.organizationId },
    select: { id: true, role: true },
  })
  if (!target) throw new ActionError(t.errors.workerNotFound)
  if (me.role !== 'ADMIN' && target.role !== 'WORKER') throw new ActionError(t.workers.cannotManageThis)
  return target
}

/** Menejer: davomatni qo'lda kiritish yoki tuzatish (kun bo'yicha upsert) */
export const saveAttendance = action(async function saveAttendance(formData: FormData) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const f = fields(t)
  const A = t.attendance
  const input = parseForm(z.object({
    userId: f.id(A.colEmployee),
    date: z.string().regex(DATE_KEY, A.invalidDate),
    status: f.oneOf(t.common.status, STATUSES),
    timeIn: f.optionalText(A.timeIn, 5),
    timeOut: f.optionalText(A.timeOut, 5),
    note: f.optionalText(t.common.note),
  }), formData)

  const target = await findEditableUser(me, input.userId)
  if (input.date > tashkentDateKey(new Date())) throw new ActionError(A.futureDate)

  let checkIn: Date | null = null
  let checkOut: Date | null = null
  if (input.status === 'PRESENT') {
    if (!input.timeIn) throw new ActionError(A.timeRequired)
    if (!isValidTime(input.timeIn) || (input.timeOut && !isValidTime(input.timeOut))) throw new ActionError(A.invalidTime)
    checkIn = atTime(input.date, input.timeIn)
    checkOut = input.timeOut ? atTime(input.date, input.timeOut) : null
    if (checkIn && checkOut && checkOut <= checkIn) throw new ActionError(A.outBeforeIn)
  }

  const data = {
    status: input.status as AttendanceStatus,
    checkIn,
    checkOut,
    note: input.note ?? null,
    source: 'MANAGER' as const,
    editedById: me.id,
  }
  await prisma.attendance.upsert({
    where: { userId_date: { userId: target.id, date: input.date } },
    update: data,
    create: { ...data, userId: target.id, date: input.date, organizationId: me.organizationId },
  })
  revalidateAttendance()
})

export const deleteAttendance = action(async function deleteAttendance(id: string) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const record = await prisma.attendance.findFirst({
    where: { id, organizationId: me.organizationId },
    select: { id: true, userId: true },
  })
  if (!record) throw new ActionError(t.errors.recordNotFound)
  await findEditableUser(me, record.userId)
  await prisma.attendance.delete({ where: { id: record.id } })
  revalidateAttendance()
})

export async function getWorkSchedule() {
  const { organizationId } = await requireRole('ADMIN', 'MANAGER')
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
  return { ...scheduleOf(org), geo: geofenceOf(org) }
}

export const updateWorkSchedule = action(async function updateWorkSchedule(formData: FormData) {
  const { organizationId } = await requireRole('ADMIN')
  const t = await getT()
  const f = fields(t)
  const A = t.attendance
  const input = parseForm(z.object({
    workStartTime: z.string().refine(isValidTime, A.invalidTime),
    workEndTime: z.string().refine(isValidTime, A.invalidTime),
    lateGraceMinutes: f.nonNegative(A.grace).pipe(z.number().int(A.grace).max(240, t.validation.tooLarge(A.grace))),
    geoLat: f.optionalNumber(A.geoLat),
    geoLng: f.optionalNumber(A.geoLng),
    geoRadiusM: f.optionalNonNegative(A.geoRadius),
  }), formData)

  if (parseTime(input.workEndTime)! <= parseTime(input.workStartTime)!) throw new ActionError(A.endBeforeStart)

  const workDays = [...new Set(formData.getAll("workDays").map(v => Number(v)))]
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 7)
    .sort((a, b) => a - b)
  if (workDays.length === 0) throw new ActionError(A.noWorkDays)

  const geoValues = [input.geoLat, input.geoLng, input.geoRadiusM]
  const geoGiven = geoValues.filter(v => v !== undefined).length
  if (geoGiven !== 0 && geoGiven !== 3) throw new ActionError(A.geoIncomplete)
  if (geoGiven === 3 && (Math.abs(input.geoLat!) > 90 || Math.abs(input.geoLng!) > 180 || input.geoRadiusM! < 20)) {
    throw new ActionError(A.geoIncomplete)
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      workStartTime: input.workStartTime,
      workEndTime: input.workEndTime,
      lateGraceMinutes: input.lateGraceMinutes,
      workDays: workDays.join(","),
      geoLat: geoGiven === 3 ? input.geoLat! : null,
      geoLng: geoGiven === 3 ? input.geoLng! : null,
      geoRadiusM: geoGiven === 3 ? Math.round(input.geoRadiusM!) : null,
    }
  })
  revalidateAttendance()
})
