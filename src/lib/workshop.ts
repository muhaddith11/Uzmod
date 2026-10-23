import { prisma } from "@/lib/prisma"
import { serializable, type Tx } from "@/lib/db"
import { roundQty } from "@/lib/domain/costing"
import { tashkentDateKey } from "@/lib/tz"

// Sexning umumiy yordamchilari. Server action faylidan tashqarida — ochiq endpoint bo'lmasin.

const HOUR_MS = 60 * 60 * 1000

/** Sexda bitta ombor: birinchisi (nomi bo'yicha); umuman yo'q bo'lsa — yaratiladi */
export async function defaultWarehouseId(tx: Tx, organizationId: string): Promise<string> {
  const existing = await tx.warehouse.findFirst({
    where: { organizationId },
    orderBy: { name: 'asc' },
    select: { id: true },
  })
  if (existing) return existing.id
  const created = await tx.warehouse.create({ data: { name: "Asosiy ombor", organizationId }, select: { id: true } })
  return created.id
}

/**
 * Ombordagi otxot (kg): partiyalardan chiqqan jami otxot minus sotilgani. Otxot aralash
 * sotiladi, shuning uchun partiyaga bog'lanmaydi; sotuv bekor qilinsa o'zi qaytadi.
 */
export async function wasteInStock(db: Tx | typeof prisma, organizationId: string): Promise<number> {
  const [produced, sold] = await Promise.all([
    db.batch.aggregate({ where: { organizationId }, _sum: { wasteKg: true } }),
    db.stockSale.aggregate({ where: { organizationId, kind: 'WASTE' }, _sum: { kg: true } }),
  ])
  return roundQty((produced._sum.wasteKg ?? 0) - (sold._sum.kg ?? 0))
}

export function readyAtFor(loadedAt: Date, hours: number): Date {
  return new Date(loadedAt.getTime() + hours * HOUR_MS)
}

/**
 * Tayyor bo'lish vaqti kelgan yuklamalarni omborga o'tkazadi: har biri o'z
 * partiyasiga (yuklangan kun + ip + gramm) qo'shiladi. Cron o'rniga sahifa va
 * amallar boshida chaqiriladi. Bir vaqtda ikki so'rov chaqirsa ham bitta yuklama
 * bir marta o'tadi (holat sharti bilan yangilanadi).
 */
export async function settleDueLoads(organizationId: string, now = new Date()): Promise<number> {
  const due = await prisma.machineLoad.findMany({
    where: { organizationId, status: 'KNITTING', readyAt: { lte: now } },
    select: { id: true },
    take: 500,
  })
  if (due.length === 0) return 0

  return serializable(async (tx) => {
    let settled = 0
    for (const { id } of due) {
      const load = await tx.machineLoad.findUnique({ where: { id } })
      if (!load || load.status !== 'KNITTING') continue
      const claimed = await tx.machineLoad.updateMany({
        where: { id, status: 'KNITTING' },
        data: { status: 'DONE', doneAt: load.readyAt },
      })
      if (claimed.count === 0) continue

      const kg = roundQty(load.kg)
      const batch = await tx.batch.upsert({
        where: {
          organizationId_date_yarnId_gramsPerSock: {
            organizationId,
            date: tashkentDateKey(load.loadedAt),
            yarnId: load.yarnId,
            gramsPerSock: load.gramsPerSock,
          },
        },
        update: { finishedKg: { increment: kg }, producedKg: { increment: kg } },
        create: {
          organizationId,
          date: tashkentDateKey(load.loadedAt),
          yarnId: load.yarnId,
          gramsPerSock: load.gramsPerSock,
          finishedKg: kg,
          producedKg: kg,
        },
      })
      await tx.machineLoad.update({ where: { id }, data: { batchId: batch.id } })
      await tx.batchMovement.create({
        data: { batchId: batch.id, type: 'PRODUCED', kg, organizationId, createdAt: load.readyAt },
      })
      settled++
    }
    return settled
  })
}
