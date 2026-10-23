import { redirect } from "next/navigation"

// Bo'limlar. Sexda sotuv va moliya ochiq; ta'minotchilar, rulonlar, retsept bo'yicha tikuv
// va umumiy ombor tizimining eski sahifalari (`legacy`: mahsulotlar va narxlar, bir nechta
// ombor, mahsulot sotuvi, mijozlar, hisobot, tarix) yashirin. Yoqib-o'chirish oynasi yo'q —
// ro'yxat shu yerda belgilanadi.
export const MODULES = ["sales", "finance", "suppliers", "rolls", "bomProduction", "legacy"] as const
export type ModuleKey = (typeof MODULES)[number]

const ENABLED: ReadonlySet<ModuleKey> = new Set<ModuleKey>(["sales", "finance"])

/** Ochiq bo'limlar */
export async function getEnabledModules(): Promise<ReadonlySet<ModuleKey>> {
  return ENABLED
}

export async function isModuleEnabled(key: ModuleKey): Promise<boolean> {
  return ENABLED.has(key)
}

/** Sahifa boshida: bo'lim yashirin bo'lsa — bosh sahifaga */
export async function requireModule(key: ModuleKey): Promise<void> {
  if (!ENABLED.has(key)) redirect("/")
}
