'use server'

import bcrypt from "bcryptjs"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { action, ActionError } from "@/lib/action"
import { fields, parseForm } from "@/lib/validation"
import { clientIp, hitRateLimit, REGISTER_LIMIT_PER_IP, REGISTER_WINDOW_MS } from "@/lib/rate-limit"
import { getT } from "@/i18n/server"

export const register = action(async function register(formData: FormData) {
  const t = await getT()
  const f = fields(t)
  const input = parseForm(z.object({
    orgName: f.text(t.auth.orgName, 100),
    name: f.text(t.auth.userName, 100),
    email: f.email(),
    password: f.newPassword(),
  }), formData)

  // Ochiq ro'yxatdan o'tish — botlar ko'plab tashkilot yaratib tashlamasin
  const ip = clientIp(await headers())
  if (!(await hitRateLimit(`register:ip:${ip}`, REGISTER_LIMIT_PER_IP, REGISTER_WINDOW_MS))) {
    throw new ActionError(t.errors.tooManyAttempts)
  }

  const exists = await prisma.user.findFirst({
    where: { email: { equals: input.email, mode: "insensitive" } },
    select: { id: true }
  })
  if (exists) throw new ActionError(t.errors.emailTaken)

  const passwordHash = await bcrypt.hash(input.password, 10)

  try {
    await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: input.orgName },
      })

      await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash,
          organizationId: organization.id,
          role: "ADMIN",
        },
      })

      // Default ombor
      await tx.warehouse.create({
        data: { name: t.auth.defaultWarehouse, organizationId: organization.id }
      })
    })
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") throw new ActionError(t.errors.emailTaken)
    throw error
  }

  redirect("/login?registered=1")
})
