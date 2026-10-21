import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  (() => {
    const connectionString = `${process.env.DATABASE_URL}`
    // Testlarda (PGlite) bitta ulanish: u bitta sessiyali, parallel ulanishlar aralashib ketadi
    const max = Number(process.env.DATABASE_POOL_MAX) || undefined
    const pool = new Pool({ connectionString, max })
    const adapter = new PrismaPg(pool)
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
    })
  })()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
