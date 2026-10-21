import { auth } from "@/auth"
import { ActionError } from "@/lib/action"

export type Role = 'ADMIN' | 'MANAGER' | 'WORKER'

export type SessionUser = {
  id: string
  organizationId: string
  role: Role
}

/**
 * Sessiyadan foydalanuvchini oladi. Har bir server action shu yerdan boshlanishi kerak.
 */
export async function getSessionUser(): Promise<SessionUser> {
  const session = await auth()
  if (!session?.user) throw new ActionError("Avtorizatsiya kerak")

  const user = session.user as any
  if (!user.organizationId) throw new ActionError("Tashkilot aniqlanmadi")

  return {
    id: user.id,
    organizationId: user.organizationId,
    // Eski sessiyalarda role bo'lmasligi mumkin — eng kam huquq bilan davom etamiz.
    role: (user.role ?? 'WORKER') as Role,
  }
}

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
    throw new ActionError("Bu amal uchun ruxsatingiz yo'q")
  }
  return user
}
