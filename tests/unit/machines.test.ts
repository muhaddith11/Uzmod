import { describe, expect, it } from "vitest"
import { batchLabel, colorHex, parseMachineNumbers, socksFromKg, yarnName } from "@/lib/domain/machines"
import { mergePunch } from "@/lib/domain/attendance"
import { handshakeOptions, parseAttLog } from "@/lib/zkteco"

describe("ipdan paypoq hisobi (gramm — bitta paypoq)", () => {
  it("kg va grammdan dona", () => {
    expect(socksFromKg(1, 20)).toBe(50)
    expect(socksFromKg(1, 30)).toBe(33)
    expect(socksFromKg(4500, 25)).toBe(180_000)
    expect(socksFromKg(0, 25)).toBe(0)
    expect(socksFromKg(5, 0)).toBe(0)
  })

  it("partiya nomi: sana + ip + gramm", () => {
    expect(batchLabel("2026-10-22", "Supreme — Qora", 25)).toBe("22.10 · Supreme — Qora · 25 g")
  })

  it("stanok raqamlari", () => {
    expect(parseMachineNumbers("1-5, 8 10-11")).toEqual([1, 2, 3, 4, 5, 8, 10, 11])
    expect(parseMachineNumbers("3,3,1")).toEqual([1, 3])
    expect(parseMachineNumbers("5-2")).toBeNull()
    expect(parseMachineNumbers("a")).toBeNull()
    expect(parseMachineNumbers("0")).toBeNull()
    expect(parseMachineNumbers("1-400")).toBeNull()
  })

  it("ip nomi va rang", () => {
    expect(yarnName(" Supreme ", "Qora")).toBe("Supreme — Qora")
    expect(colorHex("Qora")).toBe("#111827")
    expect(colorHex("Чёрный")).toBe("#111827")
    expect(colorHex("noma'lum")).toBe("#d1d5db")
  })
})

describe("Face ID belgilari", () => {
  const at = (time: string) => new Date(`2026-10-22T${time}:00+05:00`)

  it("birinchisi — kelish, oxirgisi — ketish, 1 daqiqadagi takror — e'tiborsiz", () => {
    let day = mergePunch(null, at("08:02"))!
    expect(day).toEqual({ checkIn: at("08:02"), checkOut: null })
    expect(mergePunch(day, at("08:02"))).toBeNull()
    day = mergePunch(day, at("13:00"))!
    day = mergePunch(day, at("18:05"))!
    expect(day).toEqual({ checkIn: at("08:02"), checkOut: at("18:05") })
    expect(mergePunch(day, at("17:00"))).toBeNull()
  })

  it("kechikib kelgan eski belgi tartibni buzmaydi", () => {
    const day = mergePunch({ checkIn: at("18:00"), checkOut: null }, at("08:00"))
    expect(day).toEqual({ checkIn: at("08:00"), checkOut: at("18:00") })
  })

  it("ATTLOG qatorlari — Toshkent vaqti", () => {
    const punches = parseAttLog("12\t2026-10-22 08:03:15\t0\t15\t0\t0\n\nbad line\n7\t2026-10-22 18:00:00\t1\t1\r\n")
    expect(punches).toEqual([
      { pin: "12", at: new Date("2026-10-22T03:03:15Z"), status: 0, verify: 15 },
      { pin: "7", at: new Date("2026-10-22T13:00:00Z"), status: 1, verify: 1 },
    ])
  })

  it("birinchi ulanish javobi", () => {
    const text = handshakeOptions("ABC123")
    expect(text).toContain("GET OPTION FROM: ABC123")
    expect(text).toContain("TimeZone=5")
    expect(text).toContain("Realtime=1")
  })
})
