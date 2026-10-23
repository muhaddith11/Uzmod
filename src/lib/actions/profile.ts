'use server'

import crypto from "crypto"
import bcrypt from "bcryptjs"
import { redirect } from "next/navigation"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getSessionUser } from "@/lib/session"
import { getBotUsername } from "@/lib/telegram"
import { action, ActionError } from "@/lib/action"
import { fields, parseForm } from "@/lib/validation"
import { signOut } from "@/auth"
import { getT } from "@/i18n/server"

const LINK_TOKEN_TTL_MINUTES = 15

/**
 * Telegram'ni ulash uchun bir martalik havola yaratib, foydalanuvchini botga yuboradi.
 * Botda "Start" bosilganda bot token bo'yicha shu hisobni topadi va xabar yuborgan
 * odamning haqiqiy Telegram ID'sini yozadi (api/bot/route.ts). ID qo'lda kiritilmaydi —
 * aks holda istalgan odam begona ID'ni o'z hisobiga ulab qo'ya olardi.
 */
export const startTelegramLink = action(async function startTelegramLink() {
  const { id } = await getSessionUser()
  const t = await getT()

  const botUsername = await getBotUsername()
  if (!botUsername) throw new ActionError(t.profile.botNotConfigured)

  const token = crypto.randomBytes(16).toString("hex")
  await prisma.user.update({
    where: { id },
    data: {
      telegramLinkToken: token,
      telegramLinkTokenExpiresAt: new Date(Date.now() + LINK_TOKEN_TTL_MINUTES * 60_000)
    }
  })

  redirect(`https://t.me/${botUsername}?start=${token}`)
})

/**
 * O'z parolini almashtirish. sessionVersion oshiriladi — boshqa qurilmalardagi
 * sessiyalar (va joriy sessiya ham) bekor bo'ladi, foydalanuvchi qayta kiradi.
 */
export const changeOwnPassword = action(async function changeOwnPassword(formData: FormData) {
  const me = await getSessionUser()
  const t = await getT()
  const f = fields(t)
  const input = parseForm(z.object({
    currentPassword: f.text(t.profile.currentPassword, 200),
    newPassword: f.newPassword(),
    repeatPassword: z.string(),
  }), formData)
  if (input.newPassword !== input.repeatPassword) throw new ActionError(t.validation.passwordsMismatch)

  const user = await prisma.user.findUnique({ where: { id: me.id } })
  if (!user?.passwordHash || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
    throw new ActionError(t.profile.wrongCurrentPassword)
  }

  await prisma.user.update({
    where: { id: me.id },
    data: {
      passwordHash: await bcrypt.hash(input.newPassword, 10),
      sessionVersion: { increment: 1 }
    }
  })

  await signOut({ redirectTo: "/login?changed=1" })
})
