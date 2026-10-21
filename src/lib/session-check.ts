import type { Role } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export type TokenClaims = {
  sub?: string
  organizationId?: string
  role?: Role
  sv?: number
  name?: string | null
}

/**
 * JWT'ni bazadagi holat bilan solishtiradi (auth.ts dagi jwt callback chaqiradi).
 * Xodim o'chirilgan, bloklangan yoki paroli almashtirilgan (sessionVersion oshgan)
 * bo'lsa — null: sessiya bekor. Aks holda rol va tashkilot bazadan yangilanadi.
 */
export async function refreshTokenFromDb<T extends TokenClaims>(token: T): Promise<T | null> {
  if (!token.sub) return null

  const user = await prisma.user.findUnique({
    where: { id: token.sub },
    select: { isActive: true, role: true, organizationId: true, sessionVersion: true, name: true },
  })
  if (!user || !user.isActive || user.sessionVersion !== (token.sv ?? 0)) return null

  token.role = user.role
  token.organizationId = user.organizationId
  token.name = user.name
  return token
}
