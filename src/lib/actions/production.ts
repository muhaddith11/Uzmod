'use server'

import { prisma } from "@/lib/prisma"
import { getOrgId, getSessionUser } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { action, ActionError } from "@/lib/action"

// Ishlab chiqarish — ishchi ham bajara oladi (sexdagi asosiy kundalik amal)
export const produceProduct = action(async function produceProduct(formData: FormData) {
  const sessionUser = await getSessionUser()
  const orgId = sessionUser.organizationId
  const productId = formData.get("productId") as string
  const fromWarehouseId = formData.get("fromWarehouseId") as string // Xomashyo olinadigan ombor
  const toWarehouseId = formData.get("toWarehouseId") as string     // Mahsulot qo'shiladigan ombor
  const quantityProduced = parseFloat(formData.get("quantityProduced") as string)
  // Vebda menejer mas'ul ishchini tanlaydi; TMA'da esa ishchi o'zi kirgan,
  // shuning uchun forma workerId yubormasa — sessiyadagi foydalanuvchi olinadi.
  // Client yuborgan workerId'ga ko'r-ko'rona ishonmaymiz: quyida org tekshiriladi.
  const workerId = (formData.get("workerId") as string) || sessionUser.id

  if (!productId || !fromWarehouseId || !toWarehouseId) {
    throw new ActionError("Barcha ma'lumotlarni kiriting")
  }

  if (!quantityProduced || quantityProduced <= 0) {
    throw new ActionError("Miqdor 0 dan katta bo'lishi kerak")
  }

  // Mahsulot shu org'ga tegishli va tayyor mahsulot ekanligini tekshirish
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId: orgId, isRawMaterial: false }
  })
  if (!product) throw new ActionError("Tayyor mahsulot topilmadi yoki ruxsat yo'q")

  // Omborlar shu org'ga tegishliligini tekshirish
  const [fromWarehouse, toWarehouse] = await Promise.all([
    prisma.warehouse.findFirst({ where: { id: fromWarehouseId, organizationId: orgId } }),
    prisma.warehouse.findFirst({ where: { id: toWarehouseId, organizationId: orgId } })
  ])
  if (!fromWarehouse) throw new ActionError("Xomashyo ombori topilmadi yoki ruxsat yo'q")
  if (!toWarehouse) throw new ActionError("Tayyor mahsulot ombori topilmadi yoki ruxsat yo'q")

  // Ishchi shu org'ga tegishliligini tekshirish
  if (workerId) {
    const worker = await prisma.user.findFirst({
      where: { id: workerId, organizationId: orgId }
    })
    if (!worker) throw new ActionError("Ishchi topilmadi yoki ruxsat yo'q")
  }

  // 1. BOM olish (narxlari bilan birga)
  const bom = await prisma.bom.findMany({
    where: { productId },
    include: { material: true }
  })

  if (bom.length === 0) throw new ActionError("Mahsulot resepti (BOM) topilmadi")

  // Rulon bilan hisoblanadigan xomashyo uchun ishchi aniq rulonni tanlashi shart.
  // Forma maydoni: rollId_<materialId>
  const selectedRollIds = new Map<string, string>()
  for (const item of bom) {
    if (!item.material.isRollTracked) continue
    const rollId = formData.get(`rollId_${item.materialId}`) as string
    if (!rollId) {
      throw new ActionError(`"${item.material.name}" uchun rulonni tanlang`)
    }
    selectedRollIds.set(item.materialId, rollId)
  }

  await prisma.$transaction(async (tx) => {
    // Serializable isolation: bir vaqtda 2 ta ishlab chiqarish bir xil materialni ikki marta ishlatolmaydi
    await tx.$executeRaw`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`

    let totalUnitCost = 0

    // 2. Xomashyolarni tekshirish, kamaytirish va tannarxni hisoblash
    for (const item of bom) {
      const needed = item.quantityNeeded * quantityProduced
      // Tannarx uchun costPrice ishlatiladi (sotuv narxi emas)
      const materialCostPrice = Number(item.material.costPrice || 0)
      totalUnitCost += item.quantityNeeded * materialCostPrice

      const stock = await tx.stockLevel.findUnique({
        where: {
          productId_warehouseId: {
            productId: item.materialId,
            warehouseId: fromWarehouseId
          }
        }
      })

      if (!stock || stock.quantity < needed) {
        const materialName = item.material.name
        throw new ActionError(`Xomashyo yetarli emas: ${materialName} (Kerak: ${needed}, Bor: ${stock?.quantity || 0})`)
      }

      if (item.material.isRollTracked) {
        // 2a. Rulonli xomashyo — ishchi tanlagan rulondan boshlab FIFO sarflaymiz.
        // Bitta rulon yetmasa, keyingi eng eski rulonlarga o'tamiz.
        const startRollId = selectedRollIds.get(item.materialId)!
        const startRoll = await tx.roll.findFirst({
          where: {
            id: startRollId,
            organizationId: orgId,
            productId: item.materialId,
            warehouseId: fromWarehouseId
          }
        })
        if (!startRoll) {
          throw new ActionError(`"${item.material.name}" uchun tanlangan rulon topilmadi yoki bu omborda emas`)
        }
        if (startRoll.status === 'FINISHED' || startRoll.currentWeight <= 0) {
          throw new ActionError(`"${item.material.name}" uchun tanlangan rulon allaqachon tugagan`)
        }

        // Boshlang'ich rulon birinchi, so'ng qolgan rulonlar eng eskisidan (FIFO)
        const otherRolls = await tx.roll.findMany({
          where: {
            organizationId: orgId,
            productId: item.materialId,
            warehouseId: fromWarehouseId,
            status: { not: 'FINISHED' },
            currentWeight: { gt: 0 },
            id: { not: startRoll.id }
          },
          orderBy: { createdAt: 'asc' }
        })
        const rollQueue = [startRoll, ...otherRolls]
        const totalRollWeight = rollQueue.reduce((acc, r) => acc + r.currentWeight, 0)
        if (totalRollWeight < needed - 0.0001) {
          throw new ActionError(
            `Rulonlarda yetarli emas: ${item.material.name} (Kerak: ${needed} ${item.material.unit}, Rulonlarda jami: ${totalRollWeight} ${item.material.unit})`
          )
        }

        // FIFO sarf — har bir rulon alohida auditga yoziladi
        let remainingNeed = needed
        for (const roll of rollQueue) {
          if (remainingNeed <= 0.0001) break
          const take = Math.min(roll.currentWeight, remainingNeed)
          const leftover = roll.currentWeight - take
          const isEmpty = leftover < 0.0001

          await tx.roll.update({
            where: { id: roll.id },
            data: {
              currentWeight: isEmpty ? 0 : leftover,
              status: isEmpty ? 'FINISHED' : 'IN_USE'
            }
          })
          await tx.stockMovement.create({
            data: {
              type: 'PRODUCTION',
              quantity: -take,
              productId: item.materialId,
              fromWarehouseId: fromWarehouseId,
              rollId: roll.id,
              organizationId: orgId,
              note: `Ishlab chiqarishga sarflandi (${quantityProduced} dona uchun)`
            }
          })
          remainingNeed -= take
        }

        await tx.stockLevel.update({
          where: { id: stock.id },
          data: { quantity: { decrement: needed } }
        })
      } else {
        // Rulonsiz xomashyo — oddiy chiqim
        await tx.stockLevel.update({
          where: { id: stock.id },
          data: { quantity: { decrement: needed } }
        })
        await tx.stockMovement.create({
          data: {
            type: 'PRODUCTION',
            quantity: -needed,
            productId: item.materialId,
            fromWarehouseId: fromWarehouseId,
            organizationId: orgId,
            note: `Ishlab chiqarishga sarflandi (${quantityProduced} dona uchun)`
          }
        })
      }
    }

    // 3. Tayyor mahsulotni ko'paytirish
    await tx.stockLevel.upsert({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId: toWarehouseId,
        }
      },
      update: {
        quantity: { increment: quantityProduced }
      },
      create: {
        productId,
        warehouseId: toWarehouseId,
        quantity: quantityProduced,
      }
    })

    // 4. Mahsulot tannarxini yangilash (material + ishchi maoshi)
    const productionWage = Number(product?.productionWage || 0)
    const totalUnitCostWithWage = totalUnitCost + productionWage

    await tx.product.update({
      where: { id: productId },
      data: { costPrice: totalUnitCostWithWage }
    })

    // Kirim tranzaksiyasi
    await tx.stockMovement.create({
      data: {
        type: 'PRODUCTION',
        quantity: quantityProduced,
        productId,
        toWarehouseId,
        workerId: workerId || null,
        organizationId: orgId,
        note: `Ishlab chiqarishdan tayyor bo'lib chiqdi (Tannarx: ${totalUnitCostWithWage.toLocaleString()} so'm, shu jumladan maosh: ${productionWage.toLocaleString()} so'm)`
      }
    })
  })

  // Ogohlantirishlarni tekshirish (Tranzaksiyadan tashqarida)
  const { checkLowStock } = await import("@/lib/alerts")
  for (const item of bom) {
    await checkLowStock(item.materialId, orgId)
  }

  revalidatePath("/inventory")
  revalidatePath("/production")
})

export async function getProductionLogs(limit = 100) {
  const orgId = await getOrgId()
  return await prisma.stockMovement.findMany({
    where: { organizationId: orgId, type: 'PRODUCTION', quantity: { gt: 0 } },
    include: { product: true, toWarehouse: true, worker: true },
    orderBy: { createdAt: 'desc' },
    take: limit
  })
}
