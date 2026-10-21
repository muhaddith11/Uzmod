'use server'

import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { getSessionUser } from "@/lib/session"
import { getBotUsername } from "@/lib/telegram"
import { redirect } from "next/navigation"

const LINK_TOKEN_TTL_MINUTES = 15

/**
 * Telegram'ni ulash uchun bir martalik havola yaratib, foydalanuvchini botga yuboradi.
 * Botda "Start" bosilganda bot token bo'yicha shu hisobni topadi va xabar yuborgan
 * odamning haqiqiy Telegram ID'sini yozadi (api/bot/route.ts). ID qo'lda kiritilmaydi —
 * aks holda istalgan odam begona ID'ni o'z hisobiga ulab qo'ya olardi.
 */
export async function startTelegramLink() {
  const { id } = await getSessionUser()

  const botUsername = await getBotUsername()
  if (!botUsername) throw new Error("Telegram bot sozlanmagan")

  const token = crypto.randomBytes(16).toString("hex")
  await prisma.user.update({
    where: { id },
    data: {
      telegramLinkToken: token,
      telegramLinkTokenExpiresAt: new Date(Date.now() + LINK_TOKEN_TTL_MINUTES * 60_000)
    }
  })

  redirect(`https://t.me/${botUsername}?start=${token}`)
}
