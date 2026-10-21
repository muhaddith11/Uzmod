import type { Role } from "@prisma/client"

export type TestUser = { id: string; organizationId: string; role: Role; name?: string | null }

let current: TestUser | null = null

export function setTestUser(user: TestUser | null) {
  current = user
}

export function getTestSession() {
  if (!current) return null
  return { user: { ...current, name: current.name ?? null }, expires: new Date(Date.now() + 3_600_000).toISOString() }
}
