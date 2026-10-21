/**
 * Paypoq sexi uchun realistik demo ma'lumot.
 * Ishga tushirish: npx tsx prisma/seed-factory.ts
 *
 * Yaratadi: rulon bilan hisoblanadigan ip, tayyor paypoq, resept (BOM),
 * rulonlar, ishchi va mijozlar. Shundan keyin tikuv oqimini sinab ko'rish mumkin.
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const org = await prisma.organization.findFirst()
  if (!org) throw new Error("Tashkilot topilmadi — avval `npx tsx prisma/seed.ts` ni ishga tushiring")
  const orgId = org.id

  const rawWarehouse = await prisma.warehouse.upsert({
    where: { id: 'wh-raw' },
    update: {},
    create: { id: 'wh-raw', name: 'Xomashyo ombori', address: 'Sex, 1-qavat', organizationId: orgId }
  })
  const goodsWarehouse = await prisma.warehouse.upsert({
    where: { id: 'wh-goods' },
    update: {},
    create: { id: 'wh-goods', name: 'Tayyor mahsulot ombori', address: 'Sex, 2-qavat', organizationId: orgId }
  })

  // Rulon bilan hisoblanadigan ip (paypoq sexining asosiy xomashyosi)
  const yarn = await prisma.product.upsert({
    where: { id: 'mat-yarn' },
    update: { isRollTracked: true },
    create: {
      id: 'mat-yarn',
      name: 'Paxta ip (oq)',
      unit: 'kg',
      isRawMaterial: true,
      isRollTracked: true,
      price: 28000,
      costPrice: 28000,
      minStockLevel: 20,
      organizationId: orgId
    }
  })

  // Rulonsiz oddiy xomashyo — ikkala yo'l ham ishlashini tekshirish uchun
  const elastic = await prisma.product.upsert({
    where: { id: 'mat-elastic' },
    update: {},
    create: {
      id: 'mat-elastic',
      name: 'Rezinka',
      unit: 'metr',
      isRawMaterial: true,
      isRollTracked: false,
      price: 500,
      costPrice: 500,
      minStockLevel: 100,
      organizationId: orgId
    }
  })

  // Tayyor mahsulot
  const sock = await prisma.product.upsert({
    where: { id: 'prod-sock' },
    update: {},
    create: {
      id: 'prod-sock',
      name: 'Erkaklar paypog\'i (41-45)',
      sku: 'PAY-M-4145',
      unit: 'juft',
      isRawMaterial: false,
      price: 12000,
      costPrice: 0,
      productionWage: 800,
      minStockLevel: 50,
      organizationId: orgId
    }
  })

  // Resept (BOM) — 1 juft paypoq uchun 0.05 kg ip va 0.4 metr rezinka
  await prisma.bom.upsert({
    where: { productId_materialId: { productId: sock.id, materialId: yarn.id } },
    update: { quantityNeeded: 0.05 },
    create: { productId: sock.id, materialId: yarn.id, quantityNeeded: 0.05 }
  })
  await prisma.bom.upsert({
    where: { productId_materialId: { productId: sock.id, materialId: elastic.id } },
    update: { quantityNeeded: 0.4 },
    create: { productId: sock.id, materialId: elastic.id, quantityNeeded: 0.4 }
  })

  // Rulonlar — 3 ta bobina
  const existingRolls = await prisma.roll.count({ where: { productId: yarn.id } })
  if (existingRolls === 0) {
    const weights = [25.4, 26.1, 24.8]
    for (const w of weights) {
      await prisma.roll.create({
        data: {
          productId: yarn.id,
          warehouseId: rawWarehouse.id,
          initialWeight: w,
          currentWeight: w,
          organizationId: orgId
        }
      })
    }
    await prisma.stockLevel.upsert({
      where: { productId_warehouseId: { productId: yarn.id, warehouseId: rawWarehouse.id } },
      update: { quantity: { increment: weights.reduce((a, b) => a + b, 0) } },
      create: {
        productId: yarn.id,
        warehouseId: rawWarehouse.id,
        quantity: weights.reduce((a, b) => a + b, 0)
      }
    })
  }

  // Rezinka qoldig'i
  await prisma.stockLevel.upsert({
    where: { productId_warehouseId: { productId: elastic.id, warehouseId: rawWarehouse.id } },
    update: {},
    create: { productId: elastic.id, warehouseId: rawWarehouse.id, quantity: 5000 }
  })

  // Ishchi
  const passwordHash = await bcrypt.hash('ishchi123', 10)
  await prisma.user.upsert({
    where: { email: 'ishchi@test.com' },
    update: {},
    create: {
      email: 'ishchi@test.com',
      name: 'Anvar Tikuvchi',
      passwordHash,
      role: 'WORKER',
      organizationId: orgId
    }
  })

  // Menejer
  await prisma.user.upsert({
    where: { email: 'menejer@test.com' },
    update: {},
    create: {
      email: 'menejer@test.com',
      name: 'Dilnoza Menejer',
      passwordHash: await bcrypt.hash('menejer123', 10),
      role: 'MANAGER',
      organizationId: orgId
    }
  })

  // Mijozlar
  await prisma.customer.upsert({
    where: { id: 'cust-1' },
    update: {},
    create: { id: 'cust-1', name: 'Chorsu do\'koni', phone: '+998 90 111 22 33', organizationId: orgId }
  })
  await prisma.customer.upsert({
    where: { id: 'cust-2' },
    update: {},
    create: { id: 'cust-2', name: 'Alisher (chakana)', phone: '+998 91 444 55 66', organizationId: orgId }
  })

  console.log('Demo ma\'lumot tayyor:')
  console.log(`  Omborlar: ${rawWarehouse.name}, ${goodsWarehouse.name}`)
  console.log(`  Xomashyo: ${yarn.name} (rulonli), ${elastic.name}`)
  console.log(`  Mahsulot: ${sock.name}`)
  console.log('  Resept: 1 juft = 0.05 kg ip + 0.4 m rezinka')
  console.log('  Rulonlar: 3 ta (25.4, 26.1, 24.8 kg)')
  console.log('')
  console.log('  Kirish:')
  console.log('    admin@test.com   / admin123')
  console.log('    menejer@test.com / menejer123')
  console.log('    ishchi@test.com  / ishchi123')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect(); await pool.end() })
