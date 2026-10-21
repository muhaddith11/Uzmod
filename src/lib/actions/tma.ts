'use server'

import { validateTelegramWebAppData } from "@/lib/telegram";
import { prisma } from "@/lib/prisma";
import { ActionError } from "@/lib/action"
import { getSessionUser } from "@/lib/session"
import { getT } from "@/i18n/server"

// initData'ni tekshiradi va foydalanuvchi ulanganini aniqlaydi (ko'rsatish uchun).
// Haqiqiy sessiya client'da signIn("telegram") orqali yaratiladi (auth.ts).
export async function authenticateTMA(initData: string) {
  const t = await getT()
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new ActionError(t.profile.botNotConfigured);

  const isValid = validateTelegramWebAppData(initData, botToken);
  if (!isValid) throw new ActionError(t.tma.invalidData);

  const userJson = new URLSearchParams(initData).get('user');
  if (!userJson) throw new ActionError(t.tma.invalidData);

  const tgUser = JSON.parse(userJson);
  const telegramId = String(tgUser.id);

  const user = await prisma.user.findUnique({
    where: { telegramId },
    include: { organization: true }
  });

  if (!user) {
    return { success: false as const, telegramId, name: String(tgUser.first_name ?? '') };
  }
  if (!user.isActive) {
    return { success: false as const, blocked: true, telegramId, name: user.name ?? '' };
  }

  return {
    success: true as const,
    user: {
      id: user.id,
      name: user.name,
      orgName: user.organization.name
    }
  };
}

/**
 * Mini App uchun ma'lumot — faqat kerakli oddiy maydonlar. Narx va tannarx ishchiga
 * yuborilmaydi; Prisma Decimal obyektlari ham client'ga o'tmaydi.
 */
export async function getTmaData() {
  const me = await getSessionUser()
  const [products, warehouses] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId: me.organizationId },
      select: { id: true, name: true, unit: true, isRawMaterial: true, isRollTracked: true },
      orderBy: { name: 'asc' }
    }),
    prisma.warehouse.findMany({
      where: { organizationId: me.organizationId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    })
  ])
  return { products, warehouses }
}
