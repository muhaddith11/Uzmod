import type { NextAuthConfig } from "next-auth"
import type { Role } from "@prisma/client"

/**
 * Sahifa darajasidagi rol himoyasi. Server action'lar baribir o'zi tekshiradi —
 * bu foydalanuvchini ruxsatsiz sahifaga umuman kiritmaslik uchun (defense in depth).
 */
const ROUTE_ROLES: { prefix: string; allowed: Role[] }[] = [
  { prefix: "/finance", allowed: ["ADMIN"] },
  { prefix: "/reports", allowed: ["ADMIN"] },
  { prefix: "/warehouses", allowed: ["ADMIN"] },
  { prefix: "/workers", allowed: ["ADMIN", "MANAGER"] },
  { prefix: "/sales", allowed: ["ADMIN", "MANAGER"] },
  { prefix: "/customers", allowed: ["ADMIN", "MANAGER"] },
  { prefix: "/suppliers", allowed: ["ADMIN", "MANAGER"] },
  { prefix: "/attendance", allowed: ["ADMIN", "MANAGER"] },
  { prefix: "/yarn", allowed: ["ADMIN", "MANAGER"] },
  { prefix: "/settings", allowed: ["ADMIN"] },
]

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user

      // Telegram Mini App o'zini initData bilan autentifikatsiya qiladi —
      // sessiyasiz yuklanishi kerak, aks holda ishchi login sahifasiga uloqtiriladi.
      if (nextUrl.pathname === "/tma") return true

      const isPublicRoute = nextUrl.pathname === "/login" || nextUrl.pathname === "/register"

      if (!isLoggedIn && !isPublicRoute) {
        return false
      }

      if (isLoggedIn && isPublicRoute) {
        return Response.redirect(new URL("/", nextUrl))
      }

      if (isLoggedIn) {
        const role = auth?.user?.role ?? "WORKER"
        const rule = ROUTE_ROLES.find(r => nextUrl.pathname.startsWith(r.prefix))
        if (rule && !rule.allowed.includes(role)) {
          return Response.redirect(new URL("/", nextUrl))
        }
      }

      return true
    },
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub
      }
      if (token.organizationId && session.user) {
        session.user.organizationId = token.organizationId
      }
      if (session.user) {
        // Eski sessiyalarda role bo'lmasligi mumkin — eng kam huquq bilan davom etamiz
        session.user.role = token.role ?? "WORKER"
      }
      return session
    },
  },
  providers: [], // auth.ts da
} satisfies NextAuthConfig
