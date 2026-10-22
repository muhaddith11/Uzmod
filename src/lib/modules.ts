import { cache } from "react"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getSessionUser } from "@/lib/session"

// Yoqib-o'chiriladigan bo'limlar. Kichik sexda keraksizlari yashiriladi — interfeys soddalashadi.
// `legacy` — umumiy ombor tizimining eski sahifalari (mahsulotlar va narxlar, bir nechta
// ombor, mahsulot sotuvi, mijozlar, hisobot, tarix).
export const MODULES = ["sales", "finance", "suppliers", "rolls", "bomProduction", "legacy"] as const
export type ModuleKey = (typeof MODULES)[number]

export function parseDisabled(value: string): Set<ModuleKey> {
  return new Set(
    value.split(",").map(v => v.trim()).filter((v): v is ModuleKey => (MODULES as readonly string[]).includes(v))
  )
}

/** Joriy tashkilotda yoqilgan bo'limlar (so'rov ichida keshlanadi) */
export const getEnabledModules = cache(async (): Promise<Set<ModuleKey>> => {
  const me = await getSessionUser()
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: me.organizationId },
    select: { disabledModules: true },
  })
  const disabled = parseDisabled(org.disabledModules)
  return new Set(MODULES.filter(m => !disabled.has(m)))
})

export async function isModuleEnabled(key: ModuleKey): Promise<boolean> {
  return (await getEnabledModules()).has(key)
}

/** Sahifa boshida: bo'lim yashirilgan bo'lsa — bosh sahifaga */
export async function requireModule(key: ModuleKey): Promise<void> {
  if (!(await isModuleEnabled(key))) redirect("/")
}
