'use server'

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getSessionUser, isManagement, requireRole, type SessionUser } from "@/lib/session"
import { action, ActionError } from "@/lib/action"
import { fields, parseForm, parseInput } from "@/lib/validation"
import { serializable, type Tx } from "@/lib/db"
import { addStock, applyIncomingCost, takeStock, totalStock } from "@/lib/inventory"
import { assertOrgWarehouse } from "@/lib/guards"
import { roundMoney, roundQty } from "@/lib/domain/costing"
import { evaluateRun, kgPerPair, parseMachineNumbers } from "@/lib/domain/machines"
import { checkLowStock } from "@/lib/alerts"
import { formatNumber } from "@/lib/format"
import { parseDateRange, startOfTashkentDayFor, type DateRangeParams } from "@/lib/tz"
import { getLocale, getT } from "@/i18n/server"

function revalidateMachines() {
  revalidatePath("/machines")
  revalidatePath("/yarn")
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

/** Stanoklar taxtasi: har bir stanok va undagi ochiq ish */
export async function getMachinesBoard() {
  const me = await getSessionUser()
  const [machines, runs] = await Promise.all([
    prisma.machine.findMany({
      where: { organizationId: me.organizationId },
      orderBy: { number: 'asc' },
    }),
    prisma.machineRun.findMany({
      where: { organizationId: me.organizationId, status: 'OPEN' },
      include: {
        yarn: { select: { name: true, color: true, yarnType: true } },
        product: { select: { name: true } },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { worker: { select: { name: true, email: true } } },
        },
      },
    }),
  ])
  const runByMachine = new Map(runs.map(r => [r.machineId, r]))

  return machines.map(m => {
    const run = runByMachine.get(m.id)
    return {
      id: m.id,
      number: m.number,
      group: m.group,
      isActive: m.isActive,
      run: run
        ? {
            id: run.id,
            yarnName: run.yarn.name,
            yarnColor: run.yarn.color,
            productName: run.product.name,
            gramsPerSock: run.gramsPerSock,
            issuedKg: run.issuedKg,
            countedPairs: run.countedPairs,
            startedAt: run.startedAt,
            lastWorker: run.events[0]?.worker ? (run.events[0].worker.name ?? run.events[0].worker.email) : null,
            ...evaluateRun({ issuedKg: run.issuedKg, countedPairs: run.countedPairs, leftoverKg: null, gramsPerSock: run.gramsPerSock }),
          }
        : null,
    }
  })
}

/** Ishga tushirish formasi uchun tanlovlar */
export async function getMachineFormOptions() {
  const me = await getSessionUser()
  const [yarns, models, warehouses, workers] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId: me.organizationId, isRawMaterial: true, yarnType: { not: null } },
      include: { stockLevels: { select: { quantity: true } } },
      orderBy: [{ yarnType: 'asc' }, { color: 'asc' }],
    }),
    prisma.product.findMany({
      where: { organizationId: me.organizationId, isRawMaterial: false },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.warehouse.findMany({
      where: { organizationId: me.organizationId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
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
    yarns: yarns.map(y => ({
      id: y.id,
      name: y.name,
      color: y.color,
      stockKg: roundQty(y.stockLevels.reduce((acc, sl) => acc + sl.quantity, 0)),
    })),
    models,
    warehouses,
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
  revalidateMachines()
})

export const setMachineActive = action(async function setMachineActive(machineId: string, active: boolean) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const machine = await prisma.machine.findFirst({ where: { id: machineId, organizationId: me.organizationId } })
  if (!machine) throw new ActionError(t.errors.recordNotFound)
  if (!active) {
    const open = await prisma.machineRun.count({ where: { machineId, status: 'OPEN' } })
    if (open > 0) throw new ActionError(t.machines.busyMachines(String(machine.number)))
  }
  await prisma.machine.update({ where: { id: machine.id }, data: { isActive: active } })
  revalidateMachines()
})

/** Ipni stanokka berish: ombordan ayiriladi, stanok ishiga qo'shiladi */
async function issueYarn(
  tx: Tx,
  params: { me: SessionUser; runId: string; machineNumber: number; yarnId: string; yarnCost: unknown; warehouseId: string; kg: number; workerId: string },
) {
  const t = await getT()
  const locale = await getLocale()
  const taken = await takeStock(tx, params.yarnId, params.warehouseId, params.kg)
  if (!taken.ok) {
    const yarn = await tx.product.findUniqueOrThrow({ where: { id: params.yarnId }, select: { name: true } })
    throw new ActionError(t.inventory.notEnough(yarn.name, `${formatNumber(taken.available, locale)} kg`))
  }
  await tx.machineRun.update({ where: { id: params.runId }, data: { issuedKg: { increment: params.kg } } })
  await tx.machineRunEvent.create({
    data: {
      runId: params.runId, type: 'ISSUE', quantity: params.kg, workerId: params.workerId,
      createdById: params.me.id, organizationId: params.me.organizationId,
    },
  })
  await tx.stockMovement.create({
    data: {
      type: 'TO_MACHINE',
      quantity: -params.kg,
      productId: params.yarnId,
      fromWarehouseId: params.warehouseId,
      machineRunId: params.runId,
      unitCost: params.yarnCost as number,
      workerId: params.workerId,
      creatorId: params.me.id,
      organizationId: params.me.organizationId,
      note: t.machines.issueNote(params.machineNumber),
    },
  })
}

/**
 * Bir nechta stanokni bir xil ip, model va grammda yurgizish. Har biriga
 * belgilangan kg ip beriladi (0 bo'lsa — keyin "Ip qo'shish" bilan).
 */
export const startRuns = action(async function startRuns(formData: FormData) {
  const me = await getSessionUser()
  const t = await getT()
  const f = fields(t)
  const M = t.machines
  const input = parseForm(z.object({
    machines: f.text(M.machineNumbers, 500),
    yarnId: f.id(M.yarn),
    productId: f.id(M.model),
    gramsPerSock: f.positive(M.gramsPerSock),
    kgPerMachine: f.nonNegative(M.kgPerMachine),
    workerId: f.optionalId(),
    rawWarehouseId: f.optionalId(),
    goodsWarehouseId: f.optionalId(),
  }), formData)
  if (input.gramsPerSock > 500) throw new ActionError(M.gramTooBig)

  const numbers = parseMachineNumbers(input.machines)
  if (!numbers) throw new ActionError(M.invalidNumbers)

  const [yarn, model, firstWarehouse] = await Promise.all([
    prisma.product.findFirst({ where: { id: input.yarnId, organizationId: me.organizationId } }),
    prisma.product.findFirst({ where: { id: input.productId, organizationId: me.organizationId } }),
    prisma.warehouse.findFirst({ where: { organizationId: me.organizationId }, orderBy: { name: 'asc' }, select: { id: true } }),
  ])
  if (!yarn || !yarn.isRawMaterial) throw new ActionError(M.notYarn)
  if (!model || model.isRawMaterial) throw new ActionError(M.notSock)
  const rawWarehouseId = input.rawWarehouseId ?? firstWarehouse?.id
  const goodsWarehouseId = input.goodsWarehouseId ?? firstWarehouse?.id
  if (!rawWarehouseId || !goodsWarehouseId) throw new ActionError(t.errors.warehouseNotFound)
  await assertOrgWarehouse(me.organizationId, rawWarehouseId)
  await assertOrgWarehouse(me.organizationId, goodsWarehouseId)
  const workerId = await resolveWorker(me, input.workerId)
  const kg = roundQty(input.kgPerMachine)

  const count = await serializable(async (tx) => {
    const machines = await tx.machine.findMany({
      where: { organizationId: me.organizationId, number: { in: numbers }, isActive: true },
      include: { runs: { where: { status: 'OPEN' }, select: { id: true } } },
    })
    const found = new Set(machines.map(m => m.number))
    const missing = numbers.filter(n => !found.has(n))
    if (missing.length > 0) throw new ActionError(M.unknownMachines(missing.join(", ")))
    const busy = machines.filter(m => m.runs.length > 0).map(m => m.number)
    if (busy.length > 0) throw new ActionError(M.busyMachines(busy.join(", ")))

    for (const machine of machines) {
      const run = await tx.machineRun.create({
        data: {
          machineId: machine.id,
          yarnId: yarn.id,
          productId: model.id,
          gramsPerSock: input.gramsPerSock,
          rawWarehouseId,
          goodsWarehouseId,
          startedById: me.id,
          organizationId: me.organizationId,
        },
      })
      if (kg > 0) {
        await issueYarn(tx, {
          me, runId: run.id, machineNumber: machine.number, yarnId: yarn.id, yarnCost: yarn.costPrice,
          warehouseId: rawWarehouseId, kg, workerId,
        })
      }
    }
    return machines.length
  })

  if (kg > 0) await checkLowStock(yarn.id, me.organizationId, kg * count)
  revalidateMachines()
})

async function findOpenRun(tx: Tx, me: SessionUser, runId: string) {
  const t = await getT()
  const run = await tx.machineRun.findFirst({
    where: { id: runId, organizationId: me.organizationId },
    include: {
      machine: { select: { number: true } },
      yarn: { select: { id: true, costPrice: true } },
      product: true,
    },
  })
  if (!run) throw new ActionError(t.machines.runNotFound)
  if (run.status !== 'OPEN') throw new ActionError(t.machines.runClosed)
  return run
}

/** Ishlayotgan stanokka ip qo'shish */
export const addYarnToRun = action(async function addYarnToRun(formData: FormData) {
  const me = await getSessionUser()
  const t = await getT()
  const f = fields(t)
  const input = parseForm(z.object({
    runId: f.id(t.machines.runNotFound),
    kg: f.positive(t.yarn.kg),
    workerId: f.optionalId(),
  }), formData)
  const workerId = await resolveWorker(me, input.workerId)
  const kg = roundQty(input.kg)

  const yarnId = await serializable(async (tx) => {
    const run = await findOpenRun(tx, me, input.runId)
    await issueYarn(tx, {
      me, runId: run.id, machineNumber: run.machine.number, yarnId: run.yarnId, yarnCost: run.yarn.costPrice,
      warehouseId: run.rawWarehouseId, kg, workerId,
    })
    return run.yarnId
  })
  await checkLowStock(yarnId, me.organizationId, kg)
  revalidateMachines()
})

/**
 * Sanoq: tayyor paypoq omborga qo'shiladi, ishchiga ishbay haq yoziladi.
 * Bir juft tannarxi = gramm bo'yicha ip (o'rtacha narxda) + ishbay haq.
 */
async function applyCount(tx: Tx, me: SessionUser, runId: string, pairs: number, workerId: string) {
  const t = await getT()
  const run = await findOpenRun(tx, me, runId)
  const product = await tx.product.findUniqueOrThrow({ where: { id: run.productId } })
  const wage = Number(product.productionWage ?? 0)
  const unitCost = roundMoney(kgPerPair(run.gramsPerSock) * Number(run.yarn.costPrice) + wage)

  const qtyBefore = await totalStock(tx, product.id)
  await addStock(tx, product.id, run.goodsWarehouseId, pairs)
  await applyIncomingCost(tx, product, qtyBefore, pairs, unitCost)

  await tx.machineRun.update({ where: { id: run.id }, data: { countedPairs: { increment: pairs } } })
  await tx.machineRunEvent.create({
    data: { runId: run.id, type: 'COUNT', quantity: pairs, workerId, createdById: me.id, organizationId: me.organizationId },
  })
  await tx.stockMovement.create({
    data: {
      type: 'PRODUCTION',
      quantity: pairs,
      productId: product.id,
      toWarehouseId: run.goodsWarehouseId,
      machineRunId: run.id,
      workerId,
      unitCost,
      unitWage: wage,
      creatorId: me.id,
      organizationId: me.organizationId,
      note: t.machines.countNote(run.machine.number, String(run.gramsPerSock)),
    },
  })
}

export const recordCount = action(async function recordCount(formData: FormData) {
  const me = await getSessionUser()
  const t = await getT()
  const f = fields(t)
  const input = parseForm(z.object({
    runId: f.id(t.machines.runNotFound),
    pairs: f.positive(t.machines.countPairs),
    workerId: f.optionalId(),
  }), formData)
  const workerId = await resolveWorker(me, input.workerId)
  await serializable(tx => applyCount(tx, me, input.runId, roundQty(input.pairs), workerId))
  revalidateMachines()
})

/** Smena yakuni: bir nechta stanok sanog'ini birdan. Maydonlar: count_<runId>, worker_<runId> */
export const recordShiftCounts = action(async function recordShiftCounts(formData: FormData) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const t = await getT()
  const f = fields(t)
  const entries: { runId: string; pairs: number; workerId?: string }[] = []
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("count_") || typeof value !== "string" || value.trim() === "") continue
    const runId = key.slice("count_".length)
    const pairs = parseInput(f.positive(t.machines.countPairs), value)
    const worker = formData.get(`worker_${runId}`)
    entries.push({ runId, pairs: roundQty(pairs), workerId: typeof worker === "string" && worker ? worker : undefined })
  }
  if (entries.length === 0) throw new ActionError(t.machines.nothingToSave)

  const resolved = await Promise.all(entries.map(async e => ({ ...e, workerId: await resolveWorker(me, e.workerId) })))
  await serializable(async (tx) => {
    for (const e of resolved) await applyCount(tx, me, e.runId, e.pairs, e.workerId)
  })
  revalidateMachines()
})

/** Stanok ishini yakunlash: qolgan ip omborga qaytadi, ixtiyoriy oxirgi sanoq */
export const closeRun = action(async function closeRun(formData: FormData) {
  const me = await getSessionUser()
  const t = await getT()
  const locale = await getLocale()
  const f = fields(t)
  const M = t.machines
  const input = parseForm(z.object({
    runId: f.id(M.runNotFound),
    leftoverKg: f.nonNegative(M.leftoverKg),
    finalPairs: f.optionalNonNegative(M.finalCount),
    workerId: f.optionalId(),
  }), formData)
  const workerId = await resolveWorker(me, input.workerId)
  const leftover = roundQty(input.leftoverKg)

  await serializable(async (tx) => {
    if (input.finalPairs && input.finalPairs > 0) {
      await applyCount(tx, me, input.runId, roundQty(input.finalPairs), workerId)
    }
    const run = await findOpenRun(tx, me, input.runId)
    if (leftover > run.issuedKg + 0.0001) throw new ActionError(M.leftoverTooMuch(formatNumber(run.issuedKg, locale)))

    if (leftover > 0) {
      await addStock(tx, run.yarnId, run.rawWarehouseId, leftover)
      await tx.machineRunEvent.create({
        data: { runId: run.id, type: 'RETURN', quantity: leftover, workerId, createdById: me.id, organizationId: me.organizationId },
      })
      await tx.stockMovement.create({
        data: {
          type: 'FROM_MACHINE',
          quantity: leftover,
          productId: run.yarnId,
          toWarehouseId: run.rawWarehouseId,
          machineRunId: run.id,
          unitCost: run.yarn.costPrice,
          workerId,
          creatorId: me.id,
          organizationId: me.organizationId,
          note: M.returnNote(run.machine.number),
        },
      })
    }
    await tx.machineRun.update({
      where: { id: run.id },
      data: { status: 'CLOSED', closedAt: new Date(), closedById: me.id, leftoverKg: leftover },
    })
  })
  revalidateMachines()
})

/**
 * Davr bo'yicha hisobot (sukut bo'yicha — bugun): har bir stanok ishi bo'yicha
 * shu davrda berilgan ip, sanalgan paypoq va ipdan kutilgan son.
 */
export async function getMachineReport(params: DateRangeParams) {
  const me = await requireRole('ADMIN', 'MANAGER')
  const createdAt = parseDateRange(params) ?? { gte: startOfTashkentDayFor(new Date()) }
  const events = await prisma.machineRunEvent.findMany({
    where: { organizationId: me.organizationId, createdAt },
    include: {
      run: {
        include: {
          machine: { select: { number: true, group: true } },
          yarn: { select: { name: true, color: true } },
          product: { select: { name: true } },
        },
      },
    },
  })

  const byRun = new Map<string, { issued: number; returned: number; counted: number; run: (typeof events)[number]["run"] }>()
  for (const e of events) {
    const row = byRun.get(e.runId) ?? { issued: 0, returned: 0, counted: 0, run: e.run }
    if (e.type === 'ISSUE') row.issued += e.quantity
    else if (e.type === 'RETURN') row.returned += e.quantity
    else row.counted += e.quantity
    byRun.set(e.runId, row)
  }

  const rows = [...byRun.values()]
    .map(({ issued, returned, counted, run }) => {
      const result = evaluateRun({ issuedKg: issued, countedPairs: counted, leftoverKg: returned, gramsPerSock: run.gramsPerSock })
      return {
        runId: run.id,
        machineNumber: run.machine.number,
        group: run.machine.group,
        yarnName: run.yarn.name,
        yarnColor: run.yarn.color,
        productName: run.product.name,
        gramsPerSock: run.gramsPerSock,
        status: run.status,
        issuedKg: roundQty(issued - returned),
        countedPairs: counted,
        expectedPairs: result.expectedPairs,
        differencePairs: result.differencePairs,
        efficiencyPercent: result.efficiencyPercent,
      }
    })
    .sort((a, b) => a.machineNumber - b.machineNumber)

  const totals = rows.reduce(
    (acc, r) => ({
      issuedKg: roundQty(acc.issuedKg + r.issuedKg),
      countedPairs: acc.countedPairs + r.countedPairs,
      expectedPairs: acc.expectedPairs + r.expectedPairs,
    }),
    { issuedKg: 0, countedPairs: 0, expectedPairs: 0 },
  )
  return { rows, totals }
}
