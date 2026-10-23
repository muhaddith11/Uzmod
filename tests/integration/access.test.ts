import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/prisma"
import { stockIn } from "@/lib/actions/stock"
import { setEmployeeActive, resetEmployeePassword, changeEmployeeRole, createEmployee } from "@/lib/actions/workers"
import { refreshTokenFromDb } from "@/lib/session-check"
import { hitRateLimit } from "@/lib/rate-limit"
import { asUser, form, resetDb, seedWorkshop, stockOf } from "../helpers"

let a: Awaited<ReturnType<typeof seedWorkshop>>
let b: Awaited<ReturnType<typeof seedWorkshop>>

beforeEach(async () => {
  await resetDb()
  a = await seedWorkshop("A sex")
  b = await seedWorkshop("B sex")
})

describe("tashkilotlar izolyatsiyasi", () => {
  it("boshqa tashkilot mahsulotiga kirim qilib bo'lmaydi", async () => {
    asUser(b.manager)
    const r = await stockIn(form({ productId: a.elastic.id, warehouseId: b.rawWh.id, quantity: 5, unitPrice: 1 }))
    expect(r.error).toMatch(/topilmadi/)
    expect(await stockOf(a.elastic.id, b.rawWh.id)).toBe(0)
  })

  it("sessiyasiz amal bajarilmaydi", async () => {
    asUser(null)
    const r = await stockIn(form({ productId: a.elastic.id, warehouseId: a.rawWh.id, quantity: 5, unitPrice: 1 }))
    expect(r.error).toMatch(/Avtorizatsiya/)
  })
})

describe("xodimlarni boshqarish", () => {
  it("bloklash sessiyani bekor qiladi, faollashtirish qaytaradi", async () => {
    const token = { sub: a.worker.id, sv: 0 }
    expect(await refreshTokenFromDb({ ...token })).toMatchObject({ role: "WORKER", organizationId: a.org.id })

    asUser(a.manager)
    expect(await setEmployeeActive(a.worker.id, false)).toEqual({})
    expect(await refreshTokenFromDb({ ...token })).toBeNull()

    expect(await setEmployeeActive(a.worker.id, true)).toEqual({})
    // Bloklashda sessionVersion oshgan — eski token baribir yaroqsiz, faqat qayta kirish bilan
    expect(await refreshTokenFromDb({ ...token })).toBeNull()
    expect(await refreshTokenFromDb({ ...token, sv: 1 })).not.toBeNull()
  })

  it("parolni tiklash eski sessiyalarni bekor qiladi", async () => {
    asUser(a.admin)
    expect(await resetEmployeePassword(form({ userId: a.manager.id, password: "yangiparol1" }))).toEqual({})
    expect(await refreshTokenFromDb({ sub: a.manager.id, sv: 0 })).toBeNull()
  })

  it("menejer faqat ishchini boshqaradi, o'zini va boshqa tashkilotni — hech kim", async () => {
    asUser(a.manager)
    expect((await setEmployeeActive(a.admin.id, false)).error).toMatch(/ruxsat/)
    expect((await setEmployeeActive(a.manager.id, false)).error).toMatch(/O'zingiz/)
    expect((await setEmployeeActive(b.worker.id, false)).error).toMatch(/topilmadi/)
    expect((await changeEmployeeRole(form({ userId: a.worker.id, role: "MANAGER" }))).error).toMatch(/ruxsat/)
    // Qo'shilgan xodim har doim sex ishchisi — lavozim formadan olinmaydi
    expect(await createEmployee(form({ name: "Yangi", role: "MANAGER" }))).toEqual({})
    expect((await prisma.user.findFirstOrThrow({ where: { organizationId: a.org.id, name: "Yangi" } })).role).toBe("WORKER")
  })

  it("admin lavozimni o'zgartiradi — token keyingi tekshiruvda yangi rolni oladi", async () => {
    asUser(a.admin)
    expect(await changeEmployeeRole(form({ userId: a.worker.id, role: "MANAGER" }))).toEqual({})
    expect(await refreshTokenFromDb({ sub: a.worker.id, sv: 0 })).toMatchObject({ role: "MANAGER" })
  })

  it("yangi xodim — faqat ism; login va parol yozilmaydi", async () => {
    asUser(a.admin)
    expect((await createEmployee(form({ name: "" }))).error).toBeTruthy()
    expect(await createEmployee(form({ name: "X", email: "x@t.uz", password: "12345678" }))).toEqual({})
    expect(await createEmployee(form({ name: "Y" }))).toEqual({})
    const x = await prisma.user.findFirstOrThrow({ where: { name: "X" } })
    expect(x).toMatchObject({ email: null, passwordHash: null, role: "WORKER", organizationId: a.org.id })
  })
})

describe("urinishlarni cheklash", () => {
  it("limitdan oshgach rad etadi, oyna tugagach qayta ruxsat", async () => {
    expect(await hitRateLimit("test:key", 2, 60_000)).toBe(true)
    expect(await hitRateLimit("test:key", 2, 60_000)).toBe(true)
    expect(await hitRateLimit("test:key", 2, 60_000)).toBe(false)
    await prisma.rateLimit.update({ where: { key: "test:key" }, data: { resetAt: new Date(Date.now() - 1000) } })
    expect(await hitRateLimit("test:key", 2, 60_000)).toBe(true)
  })
})
