import { cache } from "react"
import type { Role } from "@prisma/client"
import { auth } from "@/auth"
import { ActionError } from "@/lib/action"
import { getT } from "@/i18n/server"

export type { Role }

export type SessionUser = {
  id: string
  organizationId: string
  role: Role
  name: string | null
}

/**
 * Sessiyadan foydalanuvchini oladi. Har bir server action shu yerdan boshlanishi kerak.
 * Xodim holati (bloklangan/rol) auth.ts dagi jwt callback'da bazadan tekshiriladi.
 */
export const getSessionUser = cache(async (): Promise<SessionUser> => {
  const session = await auth()
  if (!session?.user?.id) throw new ActionError((await getT()).errors.unauthorized)
  if (!session.user.organizationId) throw new ActionError((await getT()).errors.noOrg)

  return {
    id: session.user.id,
    organizationId: session.user.organizationId,
    role: session.user.role ?? "WORKER",
    name: session.user.name ?? null,
  }
})

export async function getOrgId(): Promise<string> {
  const user = await getSessionUser()
  return user.organizationId
}

/**
 * Amalni faqat ruxsat etilgan rollar bajara olishini ta'minlaydi.
 * Masalan: const user = await requireRole('ADMIN', 'MANAGER')
 */
export async function requireRole(...allowed: Role[]): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!allowed.includes(user.role)) {
    throw new ActionError((await getT()).errors.forbidden)
  }
  return user
}

export function isManagement(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER"
}
