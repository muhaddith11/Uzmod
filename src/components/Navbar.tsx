import Link from 'next/link'
import type { Role } from '@prisma/client'
import { auth, signOut } from "@/auth"
import { Button } from "@/components/ui/button"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { getT } from "@/i18n/server"
import { getEnabledModules, type ModuleKey } from "@/lib/modules"
import type { Messages } from "@/i18n/messages"
import {
  Package2Icon, BoxIcon, HammerIcon, DiscIcon, HistoryIcon, LogOutIcon, TruckIcon,
  UserIcon, ShoppingBagIcon, UsersIcon, WarehouseIcon, BarChart3Icon, ClockIcon, CogIcon, Settings2Icon, WalletIcon
} from "lucide-react"

// Navigatsiya — auth.config.ts dagi ROUTE_ROLES bilan bir xil ruxsatlar.
// `roles` bo'lmasa — hamma ko'radi.
const NAV_ITEMS: { href: string; label: keyof Messages["nav"]; icon: React.ReactNode; roles?: Role[]; module?: ModuleKey }[] = [
  { href: "/stock", label: "stock", icon: <WarehouseIcon className="w-4 h-4" />, roles: ['ADMIN', 'MANAGER'] },
  { href: "/machines", label: "machines", icon: <CogIcon className="w-4 h-4" /> },
  { href: "/sales", label: "sales", icon: <ShoppingBagIcon className="w-4 h-4" />, roles: ['ADMIN', 'MANAGER'], module: "sales" },
  { href: "/finance", label: "finance", icon: <WalletIcon className="w-4 h-4" />, roles: ['ADMIN'], module: "finance" },
  { href: "/workers", label: "workers", icon: <UserIcon className="w-4 h-4" />, roles: ['ADMIN', 'MANAGER'] },
  { href: "/attendance", label: "attendance", icon: <ClockIcon className="w-4 h-4" />, roles: ['ADMIN', 'MANAGER'] },
  { href: "/rolls", label: "rolls", icon: <DiscIcon className="w-4 h-4" />, module: "rolls" },
  { href: "/production", label: "production", icon: <HammerIcon className="w-4 h-4" />, module: "bomProduction" },
  { href: "/suppliers", label: "suppliers", icon: <TruckIcon className="w-4 h-4" />, roles: ['ADMIN', 'MANAGER'], module: "suppliers" },
  // Eski umumiy ombor tizimi (sukut bo'yicha yashirin)
  { href: "/inventory", label: "inventory", icon: <Package2Icon className="w-4 h-4" />, module: "legacy" },
  { href: "/warehouses", label: "warehouses", icon: <BoxIcon className="w-4 h-4" />, roles: ['ADMIN'], module: "legacy" },
  { href: "/sales/products", label: "productSales", icon: <ShoppingBagIcon className="w-4 h-4" />, roles: ['ADMIN', 'MANAGER'], module: "legacy" },
  { href: "/customers", label: "customers", icon: <UsersIcon className="w-4 h-4" />, roles: ['ADMIN', 'MANAGER'], module: "legacy" },
  { href: "/reports", label: "reports", icon: <BarChart3Icon className="w-4 h-4" />, roles: ['ADMIN'], module: "legacy" },
  { href: "/history", label: "history", icon: <HistoryIcon className="w-4 h-4" />, module: "legacy" },
  { href: "/settings", label: "settings", icon: <Settings2Icon className="w-4 h-4" />, roles: ['ADMIN'] },
]

export default async function Navbar() {
  const session = await auth()
  if (!session) return null

  const t = await getT()
  const role = session.user.role ?? 'WORKER'
  const modules = await getEnabledModules()
  const visibleItems = NAV_ITEMS.filter(item =>
    (!item.roles || item.roles.includes(role)) && (!item.module || modules.has(item.module))
  )

  return (
    <nav className="bg-white border-b border-gray-100 px-4 md:px-6 py-3 sticky top-0 z-40 shadow-sm">
      <div className="max-w-[90rem] mx-auto flex justify-between items-center gap-4">
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/" className="text-xl md:text-2xl font-black text-indigo-600 tracking-tighter shrink-0">
            {t.common.appName} <span className="text-gray-300 font-light">| {t.common.appSuffix}</span>
          </Link>

          <div className="hidden xl:flex gap-0.5 flex-wrap">
            {visibleItems.map(item => (
              <NavLink key={item.href} href={item.href} icon={item.icon} label={t.nav[item.label]} />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <LanguageSwitcher />
          <Link href="/profile" className="flex flex-col items-end mr-1 hover:opacity-70 transition-opacity min-w-0">
            <span className="text-sm font-bold text-gray-900 truncate max-w-[10rem]">{session.user.name}</span>
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">{t.common.roles[role]}</span>
          </Link>

          <form action={async () => { 'use server'; await signOut({ redirectTo: "/login" }) }}>
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              title={t.auth.signOut}
              aria-label={t.auth.signOut}
              className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
            >
              <LogOutIcon className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </div>

      {/* Mobil/planshet uchun — pastda o'ralib turadigan havolalar */}
      <div className="xl:hidden flex gap-0.5 overflow-x-auto mt-3 pt-3 border-t border-gray-50 -mx-1 px-1">
        {visibleItems.map(item => (
          <NavLink key={item.href} href={item.href} icon={item.icon} label={t.nav[item.label]} />
        ))}
      </div>
    </nav>
  )
}

function NavLink({ href, icon, label }: { href: string, icon: React.ReactNode, label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 font-semibold transition-colors px-3 py-2 text-sm whitespace-nowrap"
    >
      {icon}
      {label}
    </Link>
  )
}
