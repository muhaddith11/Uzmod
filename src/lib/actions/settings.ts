'use server'

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/session"
import { action, ActionError } from "@/lib/action"
import { fields, parseForm } from "@/lib/validation"
import { getT } from "@/i18n/server"

export async function getSettings() {
  const { organizationId } = await requireRole('ADMIN')
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [org, devices, unknown] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { autoTransferHours: true } }),
    prisma.attendanceDevice.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { punches: true } } },
    }),
    prisma.devicePunch.groupBy({
      by: ['pin'],
      where: { organizationId, userId: null, punchedAt: { gte: since } },
      _max: { punchedAt: true },
      _count: { _all: true },
    }),
  ])
  // Qurilma oxirgi 5 daqiqada aloqaga chiqqan bo'lsa — onlayn
  const onlineSince = Date.now() - 5 * 60 * 1000
  return {
    autoTransferHours: org.autoTransferHours,
    devices: devices.map(d => ({
      id: d.id,
      name: d.name,
      serialNumber: d.serialNumber,
      isActive: d.isActive,
      lastSeenAt: d.lastSeenAt,
      online: d.lastSeenAt !== null && d.lastSeenAt.getTime() > onlineSince,
      punches: d._count.punches,
    })),
    unknownPins: unknown
      .map(u => ({ pin: u.pin, lastPunch: u._max.punchedAt, count: u._count._all }))
      .sort((a, b) => a.pin.localeCompare(b.pin)),
  }
}

/** Stanokka ip qo'yilgandan necha soatdan keyin paypoq omborga o'tadi (yangi yuklamalar uchun) */
export const updateAutoTransfer = action(async function updateAutoTransfer(formData: FormData) {
  const { organizationId } = await requireRole('ADMIN')
  const t = await getT()
  const f = fields(t)
  const input = parseForm(z.object({
    autoTransferHours: f.positive(t.settings.autoTransferHours).pipe(
      z.number().int(t.settings.autoTransferRange).min(1, t.settings.autoTransferRange).max(240, t.settings.autoTransferRange),
    ),
  }), formData)
  await prisma.organization.update({ where: { id: organizationId }, data: { autoTransferHours: input.autoTransferHours } })
  revalidatePath("/settings")
  revalidatePath("/machines")
})

export const addDevice = action(async function addDevice(formData: FormData) {
  const { organizationId } = await requireRole('ADMIN')
  const t = await getT()
  const f = fields(t)
  const S = t.settings
  const input = parseForm(z.object({
    serialNumber: f.text(S.serialNumber, 60),
    name: f.text(S.deviceName, 60),
  }), formData)
  const serialNumber = input.serialNumber.replace(/\s/g, "").toUpperCase()

  try {
    await prisma.attendanceDevice.create({ data: { serialNumber, name: input.name, organizationId } })
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') throw new ActionError(S.deviceTaken)
    throw error
  }
  revalidatePath("/settings")
  revalidatePath("/attendance")
  revalidatePath("/")
})

export const deleteDevice = action(async function deleteDevice(id: string) {
  const { organizationId } = await requireRole('ADMIN')
  const t = await getT()
  const { count } = await prisma.attendanceDevice.deleteMany({ where: { id, organizationId } })
  if (count === 0) throw new ActionError(t.errors.recordNotFound)
  revalidatePath("/settings")
  revalidatePath("/attendance")
  revalidatePath("/")
})
