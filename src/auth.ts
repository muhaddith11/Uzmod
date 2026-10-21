import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram";
import bcrypt from "bcryptjs";

export const { 
  handlers: { GET, POST }, 
  auth, 
  signIn, 
  signOut 
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const { email, password } = credentials as any;

        try {
          const user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user) {
            return null;
          }

          const passwordsMatch = await bcrypt.compare(password, user.passwordHash);

          if (passwordsMatch) {
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              organizationId: user.organizationId,
              role: user.role,
            } as any;
          }

          return null;
        } catch (error) {
          console.error("AUTH_ERROR:", error);
          return null;
        }
      },
    }),
    // Telegram Mini App — initData HMAC orqali haqiqiy sessiya yaratadi.
    // Parol o'rniga Telegram tomonidan imzolangan initData tekshiriladi.
    Credentials({
      id: "telegram",
      name: "Telegram",
      credentials: { initData: {} },
      async authorize(credentials) {
        const initData = (credentials as any)?.initData as string;
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!initData || !botToken) return null;

        if (!validateTelegramWebAppData(initData, botToken)) return null;

        try {
          const params = new URLSearchParams(initData);
          const userJson = params.get("user");
          if (!userJson) return null;
          const tgUser = JSON.parse(userJson);
          const telegramId = tgUser.id?.toString();
          if (!telegramId) return null;

          const user = await prisma.user.findUnique({ where: { telegramId } });
          if (!user) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            organizationId: user.organizationId,
            role: user.role,
          } as any;
        } catch (error) {
          console.error("TMA_AUTH_ERROR:", error);
          return null;
        }
      },
    }),
  ],
});
