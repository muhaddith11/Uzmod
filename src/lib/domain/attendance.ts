// Davomat hisob-kitobi (bazasiz, sof funksiyalar). Barcha kunlar Toshkent vaqtida.
import { addDays, startOfTashkentDay, tashkentDateKey } from "../tz"

export type Schedule = {
  workStartTime: string // "08:00"
  workEndTime: string // "18:00"
  lateGraceMinutes: number
  workDays: number[] // ISO: 1 = dushanba ... 7 = yakshanba
}

export type DayStatus = "PRESENT" | "SICK" | "VACATION" | "EXCUSED"

export type DayRecord = {
  date: string
  status: DayStatus
  checkIn: Date | null
  checkOut: Date | null
}

const MINUTE = 60_000
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/** "08:30" → 510 (daqiqa). Noto'g'ri format — null */
export function parseTime(value: string): number | null {
  const match = TIME_RE.exec(value.trim())
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

export function isValidTime(value: string): boolean {
  return parseTime(value) !== null
}

/** "1,2,3" → [1, 2, 3] (takrorsiz, tartiblangan, faqat 1..7) */
export function parseWorkDays(value: string): number[] {
  return [...new Set(value.split(",").map(v => Number(v.trim())).filter(n => Number.isInteger(n) && n >= 1 && n <= 7))]
    .sort((a, b) => a - b)
}

/** YYYY-MM-DD → ISO hafta kuni (1 = dushanba) */
export function isoWeekday(dateKey: string): number {
  const day = new Date(`${dateKey}T00:00:00Z`).getUTCDay()
  return day === 0 ? 7 : day
}

/** Kunning shu daqiqasi (Toshkent) — UTC Date */
export function atMinutes(dateKey: string, minutes: number): Date {
  return new Date(startOfTashkentDay(dateKey).getTime() + minutes * MINUTE)
}

/** "HH:MM" → shu kundagi vaqt. Noto'g'ri format — null */
export function atTime(dateKey: string, time: string): Date | null {
  const minutes = parseTime(time)
  return minutes === null ? null : atMinutes(dateKey, minutes)
}

/** Ikki nuqta orasidagi masofa (metr), haversine */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)))
}

const minutesBetween = (from: Date, to: Date) => Math.max(0, Math.round((to.getTime() - from.getTime()) / MINUTE))

export type DayEvaluation = {
  workedMinutes: number
  lateMinutes: number
  earlyLeaveMinutes: number
  overtimeMinutes: number
  // Ishda (bugun, ketish belgilanmagan)
  inProgress: boolean
  // O'tgan kun, ketish belgilanmagan — soat hisoblanmaydi, menejer tuzatishi kerak
  missingCheckout: boolean
}

/**
 * Bir kunlik yozuvni baholaydi. Kechikish ish boshlanishidan hisoblanadi, lekin
 * ruxsat etilgan daqiqalar ichida kelganlar kechikkan sanalmaydi.
 */
export function evaluateDay(record: DayRecord, schedule: Schedule, now: Date): DayEvaluation {
  const empty: DayEvaluation = {
    workedMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0, inProgress: false, missingCheckout: false,
  }
  if (record.status !== "PRESENT" || !record.checkIn) return empty

  const start = atTime(record.date, schedule.workStartTime)
  const end = atTime(record.date, schedule.workEndTime)
  const isToday = record.date === tashkentDateKey(now)

  const late = start ? minutesBetween(start, record.checkIn) : 0
  const lateMinutes = late > schedule.lateGraceMinutes ? late : 0

  if (!record.checkOut) {
    return {
      ...empty,
      lateMinutes,
      inProgress: isToday,
      missingCheckout: !isToday,
      workedMinutes: isToday ? minutesBetween(record.checkIn, now) : 0,
    }
  }

  // Qo'shimcha ish — ish tugaganidan keyin haqiqatda ishlangan vaqt (kech kelgan bo'lsa,
  // kelgan paytdan); erta ketish — ish tugashidan oldin ketilgan vaqt
  const overtimeFrom = end && record.checkIn > end ? record.checkIn : end
  return {
    workedMinutes: minutesBetween(record.checkIn, record.checkOut),
    lateMinutes,
    earlyLeaveMinutes: end ? minutesBetween(record.checkOut, end) : 0,
    overtimeMinutes: overtimeFrom ? minutesBetween(overtimeFrom, record.checkOut) : 0,
    inProgress: false,
    missingCheckout: false,
  }
}

/** [from, to] oralig'idagi ish kunlari (ikkala chet ham kiradi) */
export function workingDaysInRange(fromKey: string, toKey: string, workDays: number[]): string[] {
  const days: string[] = []
  let cursor = startOfTashkentDay(fromKey)
  const last = startOfTashkentDay(toKey)
  // Xato oraliqdan himoya: 400 kundan ko'p emas
  for (let i = 0; cursor <= last && i < 400; i++) {
    const key = tashkentDateKey(cursor)
    if (workDays.includes(isoWeekday(key))) days.push(key)
    cursor = addDays(cursor, 1)
  }
  return days
}

export type AttendanceSummary = {
  workingDays: number
  presentDays: number
  absentDays: number
  lateCount: number
  lateMinutes: number
  earlyLeaveCount: number
  earlyLeaveMinutes: number
  workedMinutes: number
  overtimeMinutes: number
  sickDays: number
  vacationDays: number
  excusedDays: number
  missingCheckouts: number
}

/**
 * Davr bo'yicha xulosa. Kelmagan kun — ish kuni, bugundan oldin (yoki bugun ish
 * boshlanib, ruxsat vaqti o'tgan), xodim tizimda bo'lgan va hech qanday yozuv yo'q.
 */
export function summarizeAttendance(params: {
  records: DayRecord[]
  schedule: Schedule
  fromKey: string
  toKey: string
  now: Date
  // Xodim qo'shilgan kun — undan oldingi kunlar kelmagan hisoblanmaydi
  employedSinceKey?: string
}): AttendanceSummary {
  const { records, schedule, now } = params
  const todayKey = tashkentDateKey(now)
  const fromKey = params.employedSinceKey && params.employedSinceKey > params.fromKey ? params.employedSinceKey : params.fromKey
  const toKey = params.toKey < todayKey ? params.toKey : todayKey

  const workingDays = fromKey <= toKey ? workingDaysInRange(fromKey, toKey, schedule.workDays) : []
  const byDate = new Map(records.map(r => [r.date, r]))

  const summary: AttendanceSummary = {
    workingDays: 0, presentDays: 0, absentDays: 0, lateCount: 0, lateMinutes: 0, earlyLeaveCount: 0,
    earlyLeaveMinutes: 0, workedMinutes: 0, overtimeMinutes: 0, sickDays: 0, vacationDays: 0, excusedDays: 0, missingCheckouts: 0,
  }

  // Bugun ish boshlanib ruxsat vaqti o'tmagan bo'lsa — bugun hali "kelmagan" emas
  const startToday = atTime(todayKey, schedule.workStartTime)
  const todayStarted = startToday ? now.getTime() > startToday.getTime() + schedule.lateGraceMinutes * MINUTE : true

  for (const day of workingDays) {
    if (day === todayKey && !todayStarted && !byDate.has(day)) continue
    summary.workingDays++
    if (!byDate.has(day)) summary.absentDays++
  }

  for (const record of records) {
    if (record.date < params.fromKey || record.date > params.toKey) continue
    if (record.status === "SICK") { summary.sickDays++; continue }
    if (record.status === "VACATION") { summary.vacationDays++; continue }
    if (record.status === "EXCUSED") { summary.excusedDays++; continue }
    if (!record.checkIn) continue

    summary.presentDays++
    const e = evaluateDay(record, schedule, now)
    summary.workedMinutes += e.workedMinutes
    summary.overtimeMinutes += e.overtimeMinutes
    if (e.lateMinutes > 0) { summary.lateCount++; summary.lateMinutes += e.lateMinutes }
    if (e.earlyLeaveMinutes > 0) { summary.earlyLeaveCount++; summary.earlyLeaveMinutes += e.earlyLeaveMinutes }
    if (e.missingCheckout) summary.missingCheckouts++
  }

  return summary
}

/** 485 → "8:05" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, "0")}`
}

/**
 * Qurilmadan kelgan belgini kunlik yozuvga qo'shadi: kunning birinchi belgisi —
 * kelish, oxirgisi — ketish. Bir daqiqa ichidagi takroriy belgi e'tiborga olinmaydi.
 * Qurilma eski belgilarni keyinroq yuborishi mumkin — tartib buzilsa ham to'g'ri.
 * null — o'zgarish yo'q.
 */
export function mergePunch(
  current: { checkIn: Date | null; checkOut: Date | null } | null,
  at: Date,
  minGapMs = 60_000,
): { checkIn: Date; checkOut: Date | null } | null {
  if (!current?.checkIn) return { checkIn: at, checkOut: current?.checkOut ?? null }
  const { checkIn, checkOut } = current
  if (at < checkIn) {
    return { checkIn: at, checkOut: checkOut ?? (checkIn.getTime() - at.getTime() >= minGapMs ? checkIn : null) }
  }
  if (at.getTime() - checkIn.getTime() < minGapMs) return null
  if (checkOut && at <= checkOut) return null
  return { checkIn, checkOut: at }
}
