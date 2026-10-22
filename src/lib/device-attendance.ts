import { prisma } from "@/lib/prisma"
import { tashkentDateKey } from "@/lib/tz"
import { mergePunch } from "@/lib/domain/attendance"
import type { ParsedPunch } from "@/lib/zkteco"

/** Ro'yxatdan o'tgan va faol qurilma — seriya raqami bo'yicha */
export async function findDevice(serialNumber: string | null) {
  if (!serialNumber) return null
  const device = await prisma.attendanceDevice.findUnique({ where: { serialNumber } })
  if (!device || !device.isActive) return null
  return device
}

export async function touchDevice(deviceId: string) {
  await prisma.attendanceDevice.update({ where: { id: deviceId }, data: { lastSeenAt: new Date() } })
}

/**
 * Bitta belgini xodim davomatiga qo'llaydi. Menejer qo'lda tuzatgan kun
 * o'zgartirilmaydi — belgi faqat xom holda saqlanadi.
 */
async function applyToAttendance(organizationId: string, userId: string, at: Date) {
  const date = tashkentDateKey(at)
  const existing = await prisma.attendance.findUnique({ where: { userId_date: { userId, date } } })

  if (!existing) {
    try {
      await prisma.attendance.create({
        data: { userId, date, status: 'PRESENT', checkIn: at, source: 'DEVICE', organizationId },
      })
      return
    } catch (error) {
      // Parallel kelgan ikkinchi belgi — qayta o'qib, odatiy tartibda qo'shamiz
      if ((error as { code?: string })?.code !== 'P2002') throw error
      return applyToAttendance(organizationId, userId, at)
    }
  }
  if (existing.source === 'MANAGER') return

  // Kasal/ta'til deb belgilangan, lekin kelgan — demak ishda
  const current = existing.status === 'PRESENT' ? existing : { checkIn: null, checkOut: null }
  const next = mergePunch(current, at)
  if (!next) return
  await prisma.attendance.update({
    where: { id: existing.id },
    data: { status: 'PRESENT', checkIn: next.checkIn, checkOut: next.checkOut, source: 'DEVICE' },
  })
}

/**
 * Qurilmadan kelgan belgilarni saqlaydi va davomatga qo'llaydi. Takroriy belgilar
 * (qurilma qayta yuborsa) bir marta hisoblanadi. Qaytaradi: qabul qilingan qatorlar soni.
 */
export async function processPunches(
  device: { id: string; organizationId: string },
  punches: ParsedPunch[],
): Promise<number> {
  if (punches.length === 0) return 0
  const pins = [...new Set(punches.map(p => p.pin))]
  const users = await prisma.user.findMany({
    where: { organizationId: device.organizationId, deviceUserId: { in: pins }, isActive: true },
    select: { id: true, deviceUserId: true },
  })
  const userByPin = new Map(users.map(u => [u.deviceUserId!, u.id]))

  for (const punch of [...punches].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    const userId = userByPin.get(punch.pin) ?? null
    try {
      await prisma.devicePunch.create({
        data: {
          deviceId: device.id,
          pin: punch.pin,
          punchedAt: punch.at,
          rawStatus: punch.status,
          verify: punch.verify,
          userId,
          organizationId: device.organizationId,
        },
      })
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') continue
      throw error
    }
    if (userId) await applyToAttendance(device.organizationId, userId, punch.at)
  }
  return punches.length
}

/**
 * Xodimga qurilma raqami berilganda — shu raqam bilan avval kelgan, lekin hech
 * kimga bog'lanmagan belgilarni ham davomatga o'tkazadi.
 */
export async function relinkPunches(organizationId: string, pin: string, userId: string) {
  const punches = await prisma.devicePunch.findMany({
    where: { organizationId, pin, userId: null },
    orderBy: { punchedAt: 'asc' },
  })
  for (const p of punches) {
    await prisma.devicePunch.update({ where: { id: p.id }, data: { userId } })
    await applyToAttendance(organizationId, userId, p.punchedAt)
  }
  return punches.length
}
