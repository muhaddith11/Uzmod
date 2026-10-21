import type { NextAuthConfig } from "next-auth";

/**
 * Sahifa darajasidagi rol himoyasi. Server action'lar baribir o'zi tekshiradi —
 * bu foydalanuvchini ruxsatsiz sahifaga umuman kiritmaslik uchun (defense in depth).
 */
const ROUTE_ROLES: { prefix: string; allowed: string[] }[] = [
  { prefix: "/finance", allowed: ["ADMIN"] },
  { prefix: "/reports", allowed: ["ADMIN"] },
  { prefix: "/warehouses", allowed: ["ADMIN"] },
  { prefix: "/workers", allowed: ["ADMIN", "MANAGER"] },
  { prefix: "/sales", allowed: ["ADMIN", "MANAGER"] },
  { prefix: "/customers", allowed: ["ADMIN", "MANAGER"] },
];

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;

      // Telegram Mini App o'zini initData bilan autentifikatsiya qiladi —
      // sessiyasiz yuklanishi kerak, aks holda ishchi login sahifasiga uloqtiriladi.
      if (nextUrl.pathname === "/tma") return true;

      const isPublicRoute = nextUrl.pathname === "/login" || nextUrl.pathname === "/register";

      if (!isLoggedIn && !isPublicRoute) {
        return false;
      }

      if (isLoggedIn && isPublicRoute) {
        return Response.redirect(new URL("/", nextUrl));
      }

      if (isLoggedIn) {
        // Eski sessiyalarda role bo'lmasligi mumkin — eng kam huquq bilan davom etamiz
        const role = (auth!.user as any)?.role ?? "WORKER";
        const rule = ROUTE_ROLES.find(r => nextUrl.pathname.startsWith(r.prefix));
        if (rule && !rule.allowed.includes(role)) {
          return Response.redirect(new URL("/", nextUrl));
        }
      }

      return true;
    },
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      if (token.organizationId && session.user) {
        (session.user as any).organizationId = token.organizationId;
      }
      if (token.role && session.user) {
        (session.user as any).role = token.role;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.organizationId = (user as any).organizationId;
        token.role = (user as any).role;
      }
      return token;
    },
  },
  providers: [], // Configured in src/auth.ts
} satisfies NextAuthConfig;
