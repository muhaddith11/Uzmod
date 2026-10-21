'use server'

import { validateTelegramWebAppData } from "@/lib/telegram";
import { prisma } from "@/lib/prisma";

// initData'ni tekshiradi va foydalanuvchi ulanganini aniqlaydi (ko'rsatish uchun).
// Haqiqiy sessiya client'da signIn("telegram") orqali yaratiladi (auth.ts).
export async function authenticateTMA(initData: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("Bot token sozlanmagan");

  const isValid = validateTelegramWebAppData(initData, botToken);
  if (!isValid) throw new Error("Haqiqiy bo'lmagan Telegram ma'lumotlari");

  const urlParams = new URLSearchParams(initData);
  const userJson = urlParams.get('user');
  if (!userJson) throw new Error("Foydalanuvchi ma'lumotlari topilmadi");

  const tgUser = JSON.parse(userJson);
  const telegramId = tgUser.id.toString();

  const user = await prisma.user.findUnique({
    where: { telegramId },
    include: { organization: true }
  });

  if (!user) {
    return { success: false, telegramId, name: tgUser.first_name };
  }

  return {
    success: true, 
    user: {
      id: user.id,
      name: user.name,
      organizationId: user.organizationId,
      orgName: user.organization.name
    } 
  };
}
