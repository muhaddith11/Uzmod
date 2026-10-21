import { prisma } from "@/lib/prisma"

/**
 * Kalit bo'yicha urinishni hisoblaydi. `limit` dan oshsa false qaytaradi.
 * Serverless'da har so'rov boshqa instansiyaga tushishi mumkin, shuning uchun
 * hisoblagich xotirada emas, bazada atomar upsert bilan saqlanadi.
 */
export async function hitRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = new Date()
  const resetAt = new Date(now.getTime() + windowMs)

  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN ${resetAt} ELSE "RateLimit"."resetAt" END
    RETURNING "count"`

  // Eskirgan yozuvlarni vaqti-vaqti bilan tozalaymiz — jadval cheksiz o'smasin
  if (Math.random() < 0.01) {
    await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: now } } }).catch(() => {})
  }

  return Number(rows[0]?.count ?? 0) <= limit
}

export async function clearRateLimit(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } })
}

/** Mijoz IP manzili (Vercel x-forwarded-for beradi) */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown"
}

export const LOGIN_WINDOW_MS = 15 * 60 * 1000
export const LOGIN_LIMIT_PER_EMAIL = 10
export const LOGIN_LIMIT_PER_IP = 50
export const REGISTER_WINDOW_MS = 60 * 60 * 1000
export const REGISTER_LIMIT_PER_IP = 5
