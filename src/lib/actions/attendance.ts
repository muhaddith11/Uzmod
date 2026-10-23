'use server'

import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { AttendanceStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getSessionUser, requireRole, type SessionUser } from "@/lib/session"
import { action, ActionError } from "@/lib/action"
import { fields, parseForm } from "@/lib/validation"
import { tashkentDateKey } from "@/lib/tz"
import { personName } from "@/lib/format"
import { atTime, evaluateDay, isoWeekday, isValidTime, parseTime, summarizeAttendance } from "@/lib/domain/attendance"
import { resolveRange, scheduleOf, toDayRecord, TRACKED_ROLES } from "@/lib/attendance"
import { getT } from "@/i18n/server"

const STATUSES = ["PRESENT", "SICK", "VACATION", "EXCUSED"] as const
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

function revalidateAttendance() {
  revalidatePath("/")
  revalidatePath("/attendance")
  revalidatePath("/workers")
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
      name: personName(u),
      role: u.role,
      state,
      recordId: r?.id ?? null,
      status: r?.status ?? null,
      checkIn: r?.checkIn ?? null,
      checkOut: r?.checkOut ?? null,
      note: r?.note ?? null,
      source: r?.source ?? null,
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

export async function getWorkSchedule() {
  const { organizationId } = await requireRole('ADMIN', 'MANAGER')
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
  return scheduleOf(org)
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
  }), formData)

  if (parseTime(input.workEndTime)! <= parseTime(input.workStartTime)!) throw new ActionError(A.endBeforeStart)

  const workDays = [...new Set(formData.getAll("workDays").map(v => Number(v)))]
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 7)
    .sort((a, b) => a - b)
  if (workDays.length === 0) throw new ActionError(A.noWorkDays)

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      workStartTime: input.workStartTime,
      workEndTime: input.workEndTime,
      lateGraceMinutes: input.lateGraceMinutes,
      workDays: workDays.join(","),
    }
  })
  revalidateAttendance()
})
