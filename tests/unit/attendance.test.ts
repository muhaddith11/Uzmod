import { describe, expect, it } from "vitest"
import {
  atTime, evaluateDay, formatDuration, isoWeekday, parseTime, parseWorkDays,
  summarizeAttendance, workingDaysInRange, type DayRecord, type Schedule,
} from "@/lib/domain/attendance"

const schedule: Schedule = { workStartTime: "08:00", workEndTime: "18:00", lateGraceMinutes: 10, workDays: [1, 2, 3, 4, 5, 6] }
const at = (date: string, time: string) => atTime(date, time)!
const present = (date: string, inTime: string, outTime?: string): DayRecord => ({
  date, status: "PRESENT", checkIn: at(date, inTime), checkOut: outTime ? at(date, outTime) : null,
})

describe("vaqt va kunlar", () => {
  it("vaqt va ish kunlarini o'qiydi", () => {
    expect(parseTime("08:30")).toBe(510)
    expect(parseTime("24:00")).toBeNull()
    expect(parseTime("8:30")).toBeNull()
    expect(parseWorkDays("6, 1,1,9,3")).toEqual([1, 3, 6])
  })

  it("Toshkent vaqti bilan hisoblaydi", () => {
    // 08:00 Toshkent = 03:00 UTC
    expect(at("2026-10-21", "08:00").toISOString()).toBe("2026-10-21T03:00:00.000Z")
    expect(isoWeekday("2026-10-21")).toBe(3) // chorshanba
    expect(isoWeekday("2026-10-25")).toBe(7) // yakshanba
  })

  it("ish kunlari — yakshanbasiz", () => {
    expect(workingDaysInRange("2026-10-19", "2026-10-25", schedule.workDays)).toEqual([
      "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24",
    ])
  })

  it("davomiylik formati", () => {
    expect(formatDuration(485)).toBe("8:05")
    expect(formatDuration(0)).toBe("0:00")
  })
})

describe("evaluateDay", () => {
  const later = new Date("2026-10-23T12:00:00Z")

  it("ruxsat vaqti ichida kechikish hisoblanmaydi, undan oshsa — boshlanishdan", () => {
    expect(evaluateDay(present("2026-10-21", "08:09", "18:00"), schedule, later).lateMinutes).toBe(0)
    expect(evaluateDay(present("2026-10-21", "08:25", "18:00"), schedule, later).lateMinutes).toBe(25)
  })

  it("ishlagan, erta ketish va qo'shimcha ish", () => {
    const early = evaluateDay(present("2026-10-21", "08:00", "16:30"), schedule, later)
    expect(early).toMatchObject({ workedMinutes: 510, earlyLeaveMinutes: 90, overtimeMinutes: 0 })
    const overtime = evaluateDay(present("2026-10-21", "07:50", "19:15"), schedule, later)
    expect(overtime).toMatchObject({ workedMinutes: 685, earlyLeaveMinutes: 0, overtimeMinutes: 75, lateMinutes: 0 })
  })

  it("ish tugagandan keyin kelsa — qo'shimcha ish faqat ishlangan vaqt", () => {
    const e = evaluateDay(present("2026-10-21", "21:04", "21:05"), schedule, later)
    expect(e).toMatchObject({ workedMinutes: 1, overtimeMinutes: 1, earlyLeaveMinutes: 0 })
  })

  it("ketish belgilanmagan: o'tgan kunda soat 0, bugun — hozirgacha", () => {
    const past = evaluateDay(present("2026-10-21", "08:00"), schedule, later)
    expect(past).toMatchObject({ workedMinutes: 0, missingCheckout: true, inProgress: false })
    const now = new Date("2026-10-21T06:30:00Z") // 11:30 Toshkent
    const today = evaluateDay(present("2026-10-21", "08:00"), schedule, now)
    expect(today).toMatchObject({ workedMinutes: 210, inProgress: true, missingCheckout: false })
  })

  it("kasal kuni hisoblanmaydi", () => {
    expect(evaluateDay({ date: "2026-10-21", status: "SICK", checkIn: null, checkOut: null }, schedule, later).workedMinutes).toBe(0)
  })
})

describe("summarizeAttendance", () => {
  it("kelmagan kunlar: faqat ish kunlari, bugungacha va ishga qo'shilgandan keyin", () => {
    const now = new Date("2026-10-24T10:00:00Z") // shanba, 15:00 Toshkent
    const s = summarizeAttendance({
      records: [
        present("2026-10-20", "08:30", "18:00"), // kechikkan
        present("2026-10-21", "08:00", "18:00"),
        { date: "2026-10-22", status: "SICK", checkIn: null, checkOut: null },
        present("2026-10-23", "08:00"), // ketish belgilanmagan
      ],
      schedule,
      fromKey: "2026-10-01",
      toKey: "2026-10-31",
      now,
      employedSinceKey: "2026-10-19",
    })
    // 19..24 — 6 ish kuni; 19 va 24 — yozuvsiz
    expect(s).toMatchObject({
      workingDays: 6,
      presentDays: 3,
      absentDays: 2,
      sickDays: 1,
      lateCount: 1,
      lateMinutes: 30,
      missingCheckouts: 1,
      workedMinutes: 570 + 600,
    })
  })

  it("bugun ish boshlanmagan bo'lsa kelmagan sanalmaydi", () => {
    const now = new Date("2026-10-21T02:30:00Z") // 07:30 Toshkent
    const s = summarizeAttendance({ records: [], schedule, fromKey: "2026-10-21", toKey: "2026-10-21", now })
    expect(s.absentDays).toBe(0)
    const afterGrace = summarizeAttendance({ records: [], schedule, fromKey: "2026-10-21", toKey: "2026-10-21", now: new Date("2026-10-21T03:15:00Z") })
    expect(afterGrace.absentDays).toBe(1)
  })
})
