import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { GET as cdataGet, POST as cdataPost } from "@/app/iclock/cdata/route"
import { GET as getRequest } from "@/app/iclock/getrequest/route"
import { addDevice, updateModules } from "@/lib/actions/settings"
import { setEmployeeDeviceId } from "@/lib/actions/workers"
import { checkIn, getMyAttendanceToday, saveAttendance } from "@/lib/actions/attendance"
import { asUser, form, resetDb, seedWorkshop } from "../helpers"

let w: Awaited<ReturnType<typeof seedWorkshop>>
const SN = "CNTEST0001"
const BASE = "https://uzmod.vercel.app/iclock"

function post(body: string, table = "ATTLOG", sn = SN) {
  return cdataPost(new Request(`${BASE}/cdata?SN=${sn}&table=${table}&Stamp=1`, { method: "POST", body }))
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-10-22T14:00:00Z")) // 19:00 Toshkent
  await resetDb()
  w = await seedWorkshop()
  asUser(w.admin)
  expect(await addDevice(form({ serialNumber: "cntest 0001", name: "Kirish" }))).toEqual({})
  expect(await setEmployeeDeviceId(form({ userId: w.worker.id, deviceUserId: "12" }))).toEqual({})
})

afterEach(() => {
  vi.useRealTimers()
})

describe("ZKTeco ADMS", () => {
  it("ro'yxatdagi qurilma sozlamalarni oladi, notanish qurilma — yo'q", async () => {
    const ok = await cdataGet(new Request(`${BASE}/cdata?SN=${SN}&options=all`))
    expect(await ok.text()).toContain(`GET OPTION FROM: ${SN}`)
    const unknown = await cdataGet(new Request(`${BASE}/cdata?SN=OTHER&options=all`))
    expect(await unknown.text()).toBe("OK")

    await getRequest(new Request(`${BASE}/getrequest?SN=${SN}`))
    expect((await prisma.attendanceDevice.findFirstOrThrow()).lastSeenAt).not.toBeNull()
  })

  it("belgilar davomatga: birinchi — kelish, oxirgi — ketish; takroriy yuborish bir marta", async () => {
    const body = "12\t2026-10-22 08:12:00\t0\t15\n12\t2026-10-22 08:12:30\t0\t15\n12\t2026-10-22 18:03:00\t1\t15\n"
    expect(await (await post(body)).text()).toBe("OK: 3")
    expect(await (await post(body)).text()).toBe("OK: 3")

    const record = await prisma.attendance.findFirstOrThrow({ where: { userId: w.worker.id } })
    expect(record).toMatchObject({
      date: "2026-10-22",
      source: "DEVICE",
      checkIn: new Date("2026-10-22T03:12:00Z"),
      checkOut: new Date("2026-10-22T13:03:00Z"),
    })
    expect(await prisma.devicePunch.count()).toBe(3)

    // Boshqa jadvallar va notanish qurilma hech narsa yozmaydi
    expect(await (await post("x", "OPERLOG")).text()).toBe("OK")
    expect(await (await post("12\t2026-10-22 09:00:00\t0\t15", "ATTLOG", "OTHER")).text()).toBe("OK")
    expect(await prisma.devicePunch.count()).toBe(3)
  })

  it("noma'lum raqam saqlanadi va xodimga raqam berilgach davomatga o'tadi", async () => {
    await post("7\t2026-10-22 07:58:00\t0\t15\n")
    expect(await prisma.attendance.count({ where: { userId: w.worker2.id } })).toBe(0)

    asUser(w.manager)
    expect(await setEmployeeDeviceId(form({ userId: w.worker2.id, deviceUserId: "7" }))).toEqual({})
    expect((await setEmployeeDeviceId(form({ userId: w.worker2.id, deviceUserId: "12" }))).error).toMatch(/boshqa xodimga/)
    const record = await prisma.attendance.findFirstOrThrow({ where: { userId: w.worker2.id } })
    expect(record.checkIn).toEqual(new Date("2026-10-22T02:58:00Z"))
  })

  it("menejer qo'lda tuzatgan kun qurilma bilan o'zgarmaydi", async () => {
    asUser(w.manager)
    await saveAttendance(form({ userId: w.worker.id, date: "2026-10-22", status: "PRESENT", timeIn: "08:00", timeOut: "17:00" }))
    await post("12\t2026-10-22 08:40:00\t0\t15\n")
    const record = await prisma.attendance.findFirstOrThrow({ where: { userId: w.worker.id } })
    expect(record.checkIn).toEqual(new Date("2026-10-22T03:00:00Z"))
    expect(record.source).toBe("MANAGER")
  })

  it("qurilma bo'lsa telefondan belgilab bo'lmaydi", async () => {
    asUser(w.worker)
    expect((await getMyAttendanceToday()).deviceMode).toBe(true)
    expect((await checkIn(form({}))).error).toMatch(/Face ID/)
  })
})

describe("bo'limlar", () => {
  it("sukut bo'yicha ta'minotchi, rulon va eski tikuv o'chiq; admin o'zgartira oladi", async () => {
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: w.org.id } })).disabledModules).toBe("suppliers,rolls,bomProduction")
    asUser(w.admin)
    expect(await updateModules(form({ modules: ["sales", "finance", "rolls"] }))).toEqual({})
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: w.org.id } })).disabledModules).toBe("suppliers,bomProduction")
    asUser(w.manager)
    expect((await updateModules(form({ modules: ["suppliers"] }))).error).toMatch(/ruxsat/)
  })
})
