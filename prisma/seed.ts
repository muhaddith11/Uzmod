/**
 * Bo'sh baza uchun boshlang'ich ma'lumot: tashkilot, admin va asosiy ombor.
 * Ishga tushirish: npx tsx prisma/seed.ts
 * So'ng demo ma'lumot uchun: npx tsx prisma/seed-factory.ts
 *
 * Admin allaqachon bo'lsa hech narsa o'zgartirilmaydi.
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: 'admin@test.com' } })
  if (existing) {
    console.log("Admin allaqachon mavjud — baza o'zgartirilmadi")
    return
  }

  const org = await prisma.organization.create({ data: { name: 'Test Korxona' } })

  await prisma.user.create({
    data: {
      email: 'admin@test.com',
      name: 'Test Admin',
      passwordHash: await bcrypt.hash('admin123', 10),
      role: 'ADMIN',
      organizationId: org.id
    }
  })

  await prisma.warehouse.create({
    data: { name: 'Asosiy Ombor', organizationId: org.id }
  })

  console.log('Boshlang\'ich ma\'lumot tayyor:')
  console.log(`  Tashkilot: ${org.name}`)
  console.log('  Admin: admin@test.com / admin123')
  console.log('  Ombor: Asosiy Ombor')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
