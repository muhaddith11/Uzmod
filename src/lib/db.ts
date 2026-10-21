import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export type Tx = Prisma.TransactionClient

function isSerializationFailure(err: unknown): boolean {
  const code = (err as { code?: string })?.code
  return code === "P2034" || code === "40001"
}

/**
 * SERIALIZABLE tranzaksiya: parallel amallar qoldiqni ikki marta sarflay olmaydi.
 * To'qnashuvda (P2034) avtomatik 3 martagacha qayta uriniladi — foydalanuvchi
 * "qayta urinib ko'ring" xabarini kamdan-kam ko'radi.
 */
export async function serializable<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 20_000,
      })
    } catch (err) {
      if (attempt < 3 && isSerializationFailure(err)) continue
      throw err
    }
  }
}
