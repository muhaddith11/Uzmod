import Link from 'next/link'
import { auth, signOut } from "@/auth"
import { Button } from "@/components/ui/button"
import {
  Package2Icon, BoxIcon, HammerIcon, DiscIcon, HistoryIcon, LogOutIcon,
  UserIcon, ShoppingBagIcon, UsersIcon, WarehouseIcon, BarChart3Icon
} from "lucide-react"

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Menejer',
  WORKER: 'Ishchi',
}

type Role = 'ADMIN' | 'MANAGER' | 'WORKER'

// Navigatsiya — auth.config.ts dagi ROUTE_ROLES bilan bir xil ruxsatlar.
// `roles` bo'lmasa — hamma ko'radi.
const NAV_ITEMS: { href: string; label: string; icon: React.ReactNode; roles?: Role[] }[] = [
  { href: "/inventory", label: "Inventar", icon: <Package2Icon className="w-4 h-4" /> },
  { href: "/rolls", label: "Rulonlar", icon: <DiscIcon className="w-4 h-4" /> },
  { href: "/production", label: "Tikuv", icon: <HammerIcon className="w-4 h-4" /> },
  { href: "/sales", label: "Sotuv", icon: <ShoppingBagIcon className="w-4 h-4" />, roles: ['ADMIN', 'MANAGER'] },
  { href: "/customers", label: "Mijozlar", icon: <UsersIcon className="w-4 h-4" />, roles: ['ADMIN', 'MANAGER'] },
  { href: "/workers", label: "Xodimlar", icon: <UserIcon className="w-4 h-4" />, roles: ['ADMIN', 'MANAGER'] },
  { href: "/warehouses", label: "Omborlar", icon: <WarehouseIcon className="w-4 h-4" />, roles: ['ADMIN'] },
  { href: "/finance", label: "Moliya", icon: <BoxIcon className="w-4 h-4" />, roles: ['ADMIN'] },
  { href: "/reports", label: "Hisobot", icon: <BarChart3Icon className="w-4 h-4" />, roles: ['ADMIN'] },
  { href: "/history", label: "Tarix", icon: <HistoryIcon className="w-4 h-4" /> },
]

export default async function Navbar() {
  const session = await auth()

  if (!session) return null

  const role = ((session.user as any)?.role as Role) ?? 'WORKER'
  const roleLabel = ROLE_LABELS[role] ?? 'Ishchi'

  const visibleItems = NAV_ITEMS.filter(item => !item.roles || item.roles.includes(role))

  return (
    <nav className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-50 shadow-sm">
      <div className="max-w-[90rem] mx-auto flex justify-between items-center gap-4">
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/" className="text-2xl font-black text-indigo-600 tracking-tighter shrink-0">
            Uzmod <span className="text-gray-300 font-light">| Ombor</span>
          </Link>

          <div className="hidden lg:flex gap-0.5 flex-wrap">
            {visibleItems.map(item => (
              <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link href="/profile" className="flex flex-col items-end mr-1 hover:opacity-70 transition-opacity">
            <span className="text-sm font-bold text-gray-900">{session.user?.name}</span>
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">{roleLabel}</span>
          </Link>

          <form action={async () => { 'use server'; await signOut() }}>
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all">
              <LogOutIcon className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </div>

      {/* Mobil/planshet uchun — pastda o'ralib turadigan havolalar */}
      <div className="lg:hidden flex gap-0.5 flex-wrap mt-3 pt-3 border-t border-gray-50">
        {visibleItems.map(item => (
          <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} />
        ))}
      </div>
    </nav>
  )
}

function NavLink({ href, icon, label }: { href: string, icon: React.ReactNode, label: string }) {
  return (
    <Link href={href}>
      <Button variant="ghost" className="flex items-center gap-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 font-semibold transition-colors px-3 text-sm">
        {icon}
        {label}
      </Button>
    </Link>
  )
}
