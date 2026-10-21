import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import {
  checkIn, checkOut, getTimesheet, getTodayBoard, saveAttendance, updateWorkSchedule,
} from "@/lib/actions/attendance"
import { asUser, form, resetDb, seedWorkshop } from "../helpers"

let w: Awaited<ReturnType<typeof seedWorkshop>>

// Sexning joylashuvi (Qo'qon markazi taxminan) va undan ~1 km uzoq nuqta
const SHOP = { lat: 40.5286, lng: 70.9425 }
const FAR = { lat: 40.5386, lng: 70.9425 }

function at(iso: string) {
  vi.setSystemTime(new Date(iso))
}

beforeEach(async () => {
  // Faqat Date soxtalashtiriladi — Prisma va tarmoq taymerlari odatdagidek ishlaydi
  vi.useFakeTimers({ toFake: ["Date"] })
  await resetDb()
  w = await seedWorkshop()
  // Xodimlar oy boshidan beri ishlaydi
  await prisma.user.updateMany({ where: { organizationId: w.org.id }, data: { createdAt: new Date("2026-09-01T00:00:00Z") } })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("o'zi belgilash", () => {
  it("kelish, ketish va takroriy bosish", async () => {
    asUser(w.worker)
    at("2026-10-21T03:25:00Z") // 08:25 Toshkent — 25 daqiqa kechikish
    expect(await checkIn(form({}))).toEqual({})
    expect((await checkIn(form({}))).error).toMatch(/allaqachon/)

    at("2026-10-21T13:00:00Z") // 18:00
    expect(await checkOut(form({}))).toEqual({})
    expect((await checkOut(form({}))).error).toMatch(/allaqachon/)

    const record = await prisma.attendance.findFirstOrThrow({ where: { userId: w.worker.id } })
    expect(record).toMatchObject({ date: "2026-10-21", status: "PRESENT", source: "SELF" })

    asUser(w.manager)
    const board = await getTodayBoard()
    const row = board.rows.find(r => r.userId === w.worker.id)!
    expect(row).toMatchObject({ state: "left", lateMinutes: 25, workedMinutes: 575 })
    // Ikkinchi ishchi belgilanmagan — ish boshlangani uchun kelmagan
    expect(board.rows.find(r => r.userId === w.worker2.id)!.state).toBe("absent")
  })

  it("kelish belgilanmasdan ketib bo'lmaydi", async () => {
    asUser(w.worker)
    at("2026-10-21T10:00:00Z")
    expect((await checkOut(form({}))).error).toMatch(/Avval kelishni/)
  })

  it("sex joylashuvi berilsa — faqat radius ichida", async () => {
    asUser(w.admin)
    expect(await updateWorkSchedule(form({
      workStartTime: "08:00", workEndTime: "18:00", lateGraceMinutes: 10,
      workDays: ["1", "2", "3", "4", "5", "6"], geoLat: SHOP.lat, geoLng: SHOP.lng, geoRadiusM: 150,
    }))).toEqual({})

    asUser(w.worker)
    at("2026-10-21T02:55:00Z")
    expect((await checkIn(form({}))).error).toMatch(/joylashuv/i)
    expect((await checkIn(form({ lat: FAR.lat, lng: FAR.lng, accuracy: 20 }))).error).toMatch(/uzoqdasiz/)
    expect(await checkIn(form({ lat: SHOP.lat + 0.0005, lng: SHOP.lng, accuracy: 15 }))).toEqual({})

    const record = await prisma.attendance.findFirstOrThrow({ where: { userId: w.worker.id } })
    expect(record.checkInDistanceM).toBeGreaterThan(40)
    expect(record.checkInDistanceM).toBeLessThan(80)
  })

  it("ish tartibida xato qiymatlar rad etiladi", async () => {
    asUser(w.admin)
    const base = { workStartTime: "08:00", workEndTime: "18:00", lateGraceMinutes: 10, workDays: ["1"] }
    expect((await updateWorkSchedule(form({ ...base, workEndTime: "07:00" }))).error).toBeTruthy()
    expect((await updateWorkSchedule(form({ ...base, workDays: [] }))).error).toBeTruthy()
    expect((await updateWorkSchedule(form({ ...base, geoLat: 40.5 }))).error).toMatch(/birga/)
    asUser(w.manager)
    expect((await updateWorkSchedule(form(base))).error).toMatch(/ruxsat/)
  })
})

describe("menejer kiritishi va tabel", () => {
  it("qo'lda kiritish, kasal kuni va ruxsatlar", async () => {
    at("2026-10-24T10:00:00Z") // shanba, 15:00 Toshkent
    asUser(w.manager)
    expect(await saveAttendance(form({ userId: w.worker.id, date: "2026-10-20", status: "PRESENT", timeIn: "08:30", timeOut: "18:00" }))).toEqual({})
    expect(await saveAttendance(form({ userId: w.worker.id, date: "2026-10-21", status: "PRESENT", timeIn: "08:00", timeOut: "17:00" }))).toEqual({})
    expect(await saveAttendance(form({ userId: w.worker.id, date: "2026-10-22", status: "SICK", note: "isitma" }))).toEqual({})

    expect((await saveAttendance(form({ userId: w.worker.id, date: "2026-10-23", status: "PRESENT" }))).error).toMatch(/vaqtini/)
    expect((await saveAttendance(form({ userId: w.worker.id, date: "2026-10-23", status: "PRESENT", timeIn: "18:00", timeOut: "08:00" }))).error).toMatch(/keyin/)
    expect((await saveAttendance(form({ userId: w.worker.id, date: "2026-10-30", status: "SICK" }))).error).toMatch(/Kelajakdagi/)
    // Menejer menejerni (o'zini ham) tuzata olmaydi
    expect((await saveAttendance(form({ userId: w.manager.id, date: "2026-10-21", status: "SICK" }))).error).toMatch(/ruxsat/)

    // Shu kunni qayta saqlash — yangi yozuv emas, yangilash
    expect(await saveAttendance(form({ userId: w.worker.id, date: "2026-10-21", status: "PRESENT", timeIn: "08:00", timeOut: "18:00" }))).toEqual({})
    expect(await prisma.attendance.count({ where: { userId: w.worker.id } })).toBe(3)

    // Ishchi o'z davomatini menejer formasi orqali o'zgartira olmaydi
    asUser(w.worker)
    expect((await saveAttendance(form({ userId: w.worker.id, date: "2026-10-23", status: "SICK" }))).error).toMatch(/ruxsat/)

    asUser(w.manager)
    const { rows } = await getTimesheet({ from: "2026-10-19", to: "2026-10-24" })
    const row = rows.find(r => r.userId === w.worker.id)!
    expect(row.summary).toMatchObject({
      workingDays: 6, presentDays: 2, sickDays: 1, absentDays: 3, lateCount: 1, lateMinutes: 30, workedMinutes: 570 + 600,
    })
  })

  it("tabelda unumdorlik: davrda tikilgan dona va soatiga", async () => {
    at("2026-10-22T10:00:00Z")
    asUser(w.manager)
    await saveAttendance(form({ userId: w.worker.id, date: "2026-10-21", status: "PRESENT", timeIn: "08:00", timeOut: "18:00" }))
    await prisma.stockMovement.create({
      data: {
        type: "PRODUCTION", quantity: 150, productId: w.sock.id, toWarehouseId: w.goodsWh.id,
        workerId: w.worker.id, organizationId: w.org.id, createdAt: new Date("2026-10-21T08:00:00Z"),
      },
    })
    const { rows } = await getTimesheet({ from: "2026-10-21", to: "2026-10-21" })
    expect(rows.find(r => r.userId === w.worker.id)).toMatchObject({ pieces: 150, piecesPerHour: 15 })
  })
})
