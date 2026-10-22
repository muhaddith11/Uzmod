import { describe, expect, it } from "vitest"
import { colorHex, evaluateRun, kgPerPair, pairsFromKg, parseMachineNumbers, socksFromKg, yarnName } from "@/lib/domain/machines"
import { mergePunch } from "@/lib/domain/attendance"
import { handshakeOptions, parseAttLog } from "@/lib/zkteco"

describe("ipdan paypoq hisobi (gramm — bitta paypoq)", () => {
  it("kg va grammdan dona va juft", () => {
    expect(socksFromKg(1, 20)).toBe(50)
    expect(pairsFromKg(1, 20)).toBe(25)
    expect(pairsFromKg(1, 30)).toBe(16) // 33 dona → 16 juft
    expect(pairsFromKg(4500, 25)).toBe(90_000)
    expect(pairsFromKg(0, 25)).toBe(0)
    expect(kgPerPair(25)).toBe(0.05)
  })

  it("stanok ishi: kutilgan, farq, chiqish va yo'qotish", () => {
    // 10 kg berildi, 1 kg qaytdi → 9 kg sarf; 25 g → 180 juft kutiladi; 170 sanaldi
    const r = evaluateRun({ issuedKg: 10, countedPairs: 170, leftoverKg: 1, gramsPerSock: 25 })
    expect(r).toEqual({ consumedKg: 9, expectedPairs: 180, differencePairs: -10, efficiencyPercent: 94, lossKg: 0.5 })
  })

  it("ochiq ish: sarf = berilgan ip", () => {
    expect(evaluateRun({ issuedKg: 5, countedPairs: 0, leftoverKg: null, gramsPerSock: 20 }).expectedPairs).toBe(125)
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
