import Link from 'next/link'
import type { Role } from '@prisma/client'
import { auth, signOut } from "@/auth"
import { Button } from "@/components/ui/button"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { NavLinks } from "@/components/NavLinks"
import { getT } from "@/i18n/server"
import { getEnabledModules, type ModuleKey } from "@/lib/modules"
import type { Messages } from "@/i18n/messages"
import { LogOutIcon } from "lucide-react"

// Navigatsiya — auth.config.ts dagi ROUTE_ROLES bilan bir xil ruxsatlar.
// `roles` bo'lmasa — hamma ko'radi. Belgilar NavLinks'da.
const NAV_ITEMS: { href: string; label: keyof Messages["nav"]; roles?: Role[]; module?: ModuleKey }[] = [
  { href: "/stock", label: "stock", roles: ['ADMIN', 'MANAGER'] },
  { href: "/machines", label: "machines" },
  { href: "/sales", label: "sales", roles: ['ADMIN', 'MANAGER'], module: "sales" },
  { href: "/finance", label: "finance", roles: ['ADMIN'], module: "finance" },
  { href: "/workers", label: "workers", roles: ['ADMIN', 'MANAGER'] },
  { href: "/attendance", label: "attendance", roles: ['ADMIN', 'MANAGER'] },
  { href: "/rolls", label: "rolls", module: "rolls" },
  { href: "/production", label: "production", module: "bomProduction" },
  { href: "/suppliers", label: "suppliers", roles: ['ADMIN', 'MANAGER'], module: "suppliers" },
  // Eski umumiy ombor tizimi (yashirin)
  { href: "/inventory", label: "inventory", module: "legacy" },
  { href: "/warehouses", label: "warehouses", roles: ['ADMIN'], module: "legacy" },
  { href: "/sales/products", label: "productSales", roles: ['ADMIN', 'MANAGER'], module: "legacy" },
  { href: "/customers", label: "customers", roles: ['ADMIN', 'MANAGER'], module: "legacy" },
  { href: "/reports", label: "reports", roles: ['ADMIN'], module: "legacy" },
  { href: "/history", label: "history", module: "legacy" },
  { href: "/settings", label: "settings", roles: ['ADMIN'] },
]

export default async function Navbar() {
  const session = await auth()
  if (!session) return null

  const t = await getT()
  const role = session.user.role ?? 'WORKER'
  const modules = await getEnabledModules()
  const items = NAV_ITEMS
    .filter(item => (!item.roles || item.roles.includes(role)) && (!item.module || modules.has(item.module)))
    .map(item => ({ href: item.href, label: t.nav[item.label] }))

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-[90rem] mx-auto px-4 md:px-6 h-16 flex items-center gap-6">
        <Link
          href="/"
          title={t.nav.dashboard}
          className="text-2xl font-black tracking-tight text-indigo-600 uppercase shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-indigo-500/30"
        >
          {t.common.appName}
        </Link>

        <div className="hidden xl:flex items-center self-stretch min-w-0">
          <NavLinks items={items} variant="bar" />
        </div>

        <div className="ml-auto flex items-center gap-2 md:gap-3 shrink-0">
          <LanguageSwitcher />
          <Link href="/profile" className="flex flex-col items-end px-1 hover:opacity-70 transition-opacity min-w-0">
            <span className="text-sm font-bold text-gray-900 truncate max-w-[10rem]">{session.user.name}</span>
            <span className="text-[11px] text-gray-500 font-medium">{t.common.roles[role]}</span>
          </Link>

          <form action={async () => { 'use server'; await signOut({ redirectTo: "/login" }) }}>
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              title={t.auth.signOut}
              aria-label={t.auth.signOut}
              className="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
            >
              <LogOutIcon className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </div>

      {/* Telefon va planshet — gorizontal aylanadigan bo'limlar qatori */}
      <div className="xl:hidden flex gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
        <NavLinks items={items} variant="scroll" />
      </div>
    </nav>
  )
}
