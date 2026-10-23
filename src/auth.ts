import NextAuth, { CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { authConfig } from "./auth.config"
import { prisma } from "@/lib/prisma"
import { validateTelegramWebAppData } from "@/lib/telegram"
import { refreshTokenFromDb } from "@/lib/session-check"
import {
  clearRateLimit, clientIp, hitRateLimit,
  LOGIN_LIMIT_PER_EMAIL, LOGIN_LIMIT_PER_IP, LOGIN_WINDOW_MS,
} from "@/lib/rate-limit"

// Login sahifasi `code` bo'yicha aniq xabar ko'rsatadi
class BlockedError extends CredentialsSignin {
  code = "blocked"
}
class RateLimitedError extends CredentialsSignin {
  code = "rate_limited"
}

type AuthUser = {
  id: string
  email: string | null
  name: string | null
  organizationId: string
  role: "ADMIN" | "MANAGER" | "WORKER"
  sessionVersion: number
}

function toAuthUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: user.organizationId,
    role: user.role,
    sessionVersion: user.sessionVersion,
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    /**
     * Har so'rovda xodim holati bazadan tekshiriladi: bloklangan, o'chirilgan yoki
     * paroli almashtirilgan (sessionVersion oshgan) bo'lsa — sessiya darhol bekor.
     * Rol ham bazadan olinadi, shuning uchun lavozim o'zgarishi qayta kirishsiz kuchga kiradi.
     */
    async jwt({ token, user }) {
      if (user) {
        token.organizationId = user.organizationId
        token.role = user.role
        token.sv = user.sessionVersion
        return token
      }

      return refreshTokenFromDb(token)
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "").trim().toLowerCase()
        const password = String(credentials?.password ?? "")
        if (!email || !password) return null

        const ip = clientIp(request.headers)
        const [emailAllowed, ipAllowed] = await Promise.all([
          hitRateLimit(`login:email:${email}`, LOGIN_LIMIT_PER_EMAIL, LOGIN_WINDOW_MS),
          hitRateLimit(`login:ip:${ip}`, LOGIN_LIMIT_PER_IP, LOGIN_WINDOW_MS),
        ])
        if (!emailAllowed || !ipAllowed) throw new RateLimitedError()

        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        })
        // Paroli yo'q xodim (sex ishchisi) tizimga kirmaydi
        if (!user?.passwordHash) return null

        const passwordsMatch = await bcrypt.compare(password, user.passwordHash)
        if (!passwordsMatch) return null
        if (!user.isActive) throw new BlockedError()

        await clearRateLimit(`login:email:${email}`)
        return toAuthUser(user)
      },
    }),
    // Telegram Mini App — initData HMAC orqali haqiqiy sessiya yaratadi.
    // Parol o'rniga Telegram tomonidan imzolangan initData tekshiriladi.
    Credentials({
      id: "telegram",
      name: "Telegram",
      credentials: { initData: {} },
      async authorize(credentials) {
        const initData = String(credentials?.initData ?? "")
        const botToken = process.env.TELEGRAM_BOT_TOKEN
        if (!initData || !botToken) return null

        if (!validateTelegramWebAppData(initData, botToken)) return null

        try {
          const userJson = new URLSearchParams(initData).get("user")
          if (!userJson) return null
          const telegramId = JSON.parse(userJson)?.id?.toString()
          if (!telegramId) return null

          const user = await prisma.user.findUnique({ where: { telegramId } })
          if (!user) return null
          if (!user.isActive) throw new BlockedError()

          return toAuthUser(user)
        } catch (error) {
          if (error instanceof CredentialsSignin) throw error
          console.error("TMA_AUTH_ERROR:", error)
          return null
        }
      },
    }),
  ],
})
