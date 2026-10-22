'use server'

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getSessionUser, isManagement, requireRole, type SessionUser } from "@/lib/session"
import { action, ActionError } from "@/lib/action"
import { fields, parseForm } from "@/lib/validation"
import { serializable } from "@/lib/db"
import { addStock, takeStock } from "@/lib/inventory"
import { roundQty } from "@/lib/domain/costing"
import { parseMachineNumbers, socksFromKg } from "@/lib/domain/machines"
import { defaultWarehouseId, readyAtFor, settleDueLoads } from "@/lib/workshop"
import { formatNumber } from "@/lib/format"
import { parseDateRange, startOfTashkentDayFor, type DateRangeParams } from "@/lib/tz"
import { getLocale, getT } from "@/i18n/server"

function revalidateWorkshop() {
  revalidatePath("/machines")
  revalidatePath("/stock")
  revalidatePath("/sales")
  revalidatePath("/")
}

/** Xodim: ishchi o'z nomidan, rahbariyat tanlagan ishchi nomidan (shu tashkilotdan, faol) */
async function resolveWorker(me: SessionUser, requested: string | undefined): Promise<string> {
  if (me.role === 'WORKER' || !requested) return me.id
  const worker = await prisma.user.findFirst({
    where: { id: requested, organizationId: me.organizationId, isActive: true },
    select: { id: true },
  })
  if (!worker) throw new ActionError((await getT()).errors.workerNotFound)
  return worker.id
}

/** Stanoklar taxtasi: har bir stanok va unda tikilayotgan ip */
export async function getMachinesBoard() {
  const me = await getSessionUser()
  await settleDueLoads(me.organizationId)
  const [machines, loads, org] = await Promise.all([
    prisma.machine.findMany({
      where: { organizationId: me.organizationId },
      orderBy: { number: 'asc' },
    }),
    prisma.machineLoad.findMany({
      where: { organizationId: me.organizationId, status: 'KNITTING' },
      include: {
        yarn: { select: { name: true, color: true } },
        worker: { select: { name: true, email: true } },
      },
      orderBy: { loadedAt: 'asc' },
    }),
    prisma.organization.findUniqueOrThrow({ where: { id: me.organizationId }, select: { autoTransferHours: true } }),
  ])
  const loadsByMachine = new Map<string, typeof loads>()
  for (const load of loads) loadsByMachine.set(load.machineId, [...(loadsByMachine.get(load.machineId) ?? []), load])

  return {
    autoTransferHours: org.autoTransferHours,
    machines: machines.map(m => ({
      id: m.id,
      number: m.number,
      group: m.group,
      isActive: m.isActive,
      loads: (loadsByMachine.get(m.id) ?? []).map(l => ({
        id: l.id,
        yarnName: l.yarn.name,
        yarnColor: l.yarn.color,
        gramsPerSock: l.gramsPerSock,
        kg: l.kg,
        socks: socksFromKg(l.kg, l.gramsPerSock),
        loadedAt: l.loadedAt,
        readyAt: l.readyAt,
        workerName: l.worker ? (l.worker.name ?? l.worker.email) : null,
      })),
    })),
  }
}

/** Ip qo'yish formasi uchun tanlovlar */
export async function getLoadFormOptions() {
  const me = await getSessionUser()
  const [yarns, workers] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId: me.organizationId, isRawMaterial: true, yarnType: { not: null } },
      include: { stockLevels: { select: { quantity: true } } },
      orderBy: [{ yarnType: 'asc' }, { color: 'asc' }],
    }),
    isManagement(me.role)
      ? prisma.user.findMany({
          where: { organizationId: me.organizationId, isActive: true, role: 'WORKER' },
          select: { id: true, name: true, email: true },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
  ])
  return {
    yarns: yarns
      .map(y => ({
        id: y.id,
        name: y.name,
        color: y.color,
        stockKg: roundQty(y.stockLevels.reduce((acc, sl) => acc + sl.quantity, 0)),
      }))
      .filter(y => y.stockKg > 0),
    workers: workers.map(w => ({ id: w.id, name: w.name ?? w.email })),
    canChooseWorker: isManagement(me.role),
  }
}

/** Stanoklarni qo'shish: "1 dan 53 gacha, A guruh" */
export const createMachines = action(async function createMachines(formData: FormData) {
  const me = await requireRole('ADMIN')
  const t = await getT()
  const f = fields(t)
  const M = t.machines
  const input = parseForm(z.object({
    from: f.positive(M.fromNumber).pipe(z.number().int(M.fromNumber)),
    to: f.positive(M.toNumber).pipe(z.number().int(M.toNumber)),
    group: f.text(M.group, 30),
  }), formData)
  if (input.to < input.from) throw new ActionError(M.invalidNumbers)
  if (input.to - input.from >= 300) throw new ActionError(M.tooMany)

  const numbers = Array.from({ length: input.to - input.from + 1 }, (_, i) => input.from + i)
  const taken = await prisma.machine.findMany({
    where: { organizationId: me.organizationId, number: { in: numbers } },
    select: { number: true },
  })
  if (taken.length > 0) throw new ActionError(M.numbersTaken(taken.map(m => m.number).join(", ")))

  await prisma.machine.createMany({
    data: numbers.map(number => ({ number, group: input.group, organizationId: me.organizationId })),
  })
  revalidateWorkshop()
})

export const setMachineActive = action(async function setMachineActive(machineId: string, active: boolean) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const machine = await prisma.machine.findFirst({ where: { id: machineId, organizationId: me.organizationId } })
  if (!machine) throw new ActionError(t.errors.recordNotFound)
  if (!active) {
    const knitting = await prisma.machineLoad.count({ where: { machineId, status: 'KNITTING' } })
    if (knitting > 0) throw new ActionError(t.machines.busyMachines(String(machine.number)))
  }
  await prisma.machine.update({ where: { id: machine.id }, data: { isActive: active } })
  revalidateWorkshop()
})

/**
 * Stanoklarga ip qo'yish: har biriga bir xil ip, gramm va kg. Ip ombordan
 * ayiriladi; belgilangan soatdan keyin paypoq o'zi tayyor partiyaga o'tadi.
 */
export const loadMachines = action(async function loadMachines(formData: FormData) {
  const me = await getSessionUser()
  const t = await getT()
  const locale = await getLocale()
  const f = fields(t)
  const M = t.machines
  const input = parseForm(z.object({
    machines: f.text(M.machineNumbers, 500),
    yarnId: f.id(M.yarn),
    gramsPerSock: f.positive(M.gramsPerSock),
    kgPerMachine: f.positive(M.kgPerMachine),
    workerId: f.optionalId(),
  }), formData)
  if (input.gramsPerSock > 500) throw new ActionError(M.gramTooBig)

  const numbers = parseMachineNumbers(input.machines)
  if (!numbers) throw new ActionError(M.invalidNumbers)

  const yarn = await prisma.product.findFirst({ where: { id: input.yarnId, organizationId: me.organizationId } })
  if (!yarn || !yarn.isRawMaterial) throw new ActionError(M.notYarn)
  const workerId = await resolveWorker(me, input.workerId)
  const kg = roundQty(input.kgPerMachine)

  await serializable(async (tx) => {
    const machines = await tx.machine.findMany({
      where: { organizationId: me.organizationId, number: { in: numbers }, isActive: true },
      orderBy: { number: 'asc' },
    })
    const found = new Set(machines.map(m => m.number))
    const missing = numbers.filter(n => !found.has(n))
    if (missing.length > 0) throw new ActionError(M.unknownMachines(missing.join(", ")))

    const org = await tx.organization.findUniqueOrThrow({ where: { id: me.organizationId }, select: { autoTransferHours: true } })
    const warehouseId = await defaultWarehouseId(tx, me.organizationId)
    const total = roundQty(kg * machines.length)
    const taken = await takeStock(tx, yarn.id, warehouseId, total)
    if (!taken.ok) throw new ActionError(t.inventory.notEnough(yarn.name, `${formatNumber(taken.available, locale)} kg`))

    const loadedAt = new Date()
    const readyAt = readyAtFor(loadedAt, org.autoTransferHours)
    await tx.machineLoad.createMany({
      data: machines.map(m => ({
        machineId: m.id,
        yarnId: yarn.id,
        gramsPerSock: input.gramsPerSock,
        kg,
        loadedAt,
        readyAt,
        workerId,
        createdById: me.id,
        organizationId: me.organizationId,
      })),
    })
    await tx.stockMovement.create({
      data: {
        type: 'TO_MACHINE',
        quantity: -total,
        productId: yarn.id,
        fromWarehouseId: warehouseId,
        workerId,
        creatorId: me.id,
        organizationId: me.organizationId,
        note: M.loadNote(input.machines, String(input.gramsPerSock)),
      },
    })
  })
  revalidateWorkshop()
})

async function findKnittingLoad(me: SessionUser, loadId: string) {
  const t = await getT()
  const load = await prisma.machineLoad.findFirst({
    where: { id: loadId, organizationId: me.organizationId },
    include: { machine: { select: { number: true } } },
  })
  if (!load) throw new ActionError(t.errors.recordNotFound)
  if (load.status !== 'KNITTING') throw new ActionError(t.machines.loadNotKnitting)
  return load
}

/** Muddatidan oldin tayyor: paypoq hozir omborga o'tadi */
export const finishLoadNow = action(async function finishLoadNow(loadId: string) {
  const me = await requireRole('ADMIN', 'MANAGER')
  await findKnittingLoad(me, loadId)
  const now = new Date()
  await prisma.machineLoad.updateMany({ where: { id: loadId, status: 'KNITTING' }, data: { readyAt: now } })
  await settleDueLoads(me.organizationId, now)
  revalidateWorkshop()
})

/** Xato qo'yilgan ip: yuklama bekor, ip omborga qaytadi */
export const cancelLoad = action(async function cancelLoad(loadId: string) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const load = await findKnittingLoad(me, loadId)

  await serializable(async (tx) => {
    const claimed = await tx.machineLoad.updateMany({
      where: { id: load.id, status: 'KNITTING' },
      data: { status: 'CANCELLED', doneAt: new Date() },
    })
    if (claimed.count === 0) throw new ActionError(t.machines.loadNotKnitting)
    const warehouseId = await defaultWarehouseId(tx, me.organizationId)
    await addStock(tx, load.yarnId, warehouseId, load.kg)
    await tx.stockMovement.create({
      data: {
        type: 'FROM_MACHINE',
        quantity: load.kg,
        productId: load.yarnId,
        toWarehouseId: warehouseId,
        workerId: load.workerId,
        creatorId: me.id,
        organizationId: me.organizationId,
        note: t.machines.cancelNote(load.machine.number),
      },
    })
  })
  revalidateWorkshop()
})

/**
 * Davr bo'yicha hisobot (sukut bo'yicha — bugun): har bir stanokka qo'yilgan ip
 * va undan chiqadigan paypoq (dona). Bekor qilinganlar kirmaydi.
 */
export async function getMachineReport(params: DateRangeParams) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const loadedAt = parseDateRange(params) ?? { gte: startOfTashkentDayFor(new Date()) }
  const loads = await prisma.machineLoad.findMany({
    where: { organizationId: me.organizationId, status: { not: 'CANCELLED' }, loadedAt },
    include: {
      machine: { select: { number: true, group: true } },
      yarn: { select: { name: true, color: true } },
    },
  })

  // Stanok + ip + gramm bo'yicha bitta qator
  const rows = new Map<string, { machineNumber: number; group: string; yarnName: string; yarnColor: string | null; gramsPerSock: number; kg: number; socks: number; knitting: boolean }>()
  for (const l of loads) {
    const key = `${l.machineId}|${l.yarnId}|${l.gramsPerSock}`
    const row = rows.get(key) ?? {
      machineNumber: l.machine.number, group: l.machine.group, yarnName: l.yarn.name, yarnColor: l.yarn.color,
      gramsPerSock: l.gramsPerSock, kg: 0, socks: 0, knitting: false,
    }
    row.kg = roundQty(row.kg + l.kg)
    row.socks += socksFromKg(l.kg, l.gramsPerSock)
    row.knitting ||= l.status === 'KNITTING'
    rows.set(key, row)
  }
  const sorted = [...rows.values()].sort((a, b) => a.machineNumber - b.machineNumber || a.gramsPerSock - b.gramsPerSock)
  const totals = sorted.reduce(
    (acc, r) => ({ kg: roundQty(acc.kg + r.kg), socks: acc.socks + r.socks }),
    { kg: 0, socks: 0 },
  )
  return { rows: sorted, totals, machines: new Set(sorted.map(r => r.machineNumber)).size }
}
