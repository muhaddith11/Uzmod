'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"
import {
  Package2Icon, BoxIcon, HammerIcon, DiscIcon, HistoryIcon, TruckIcon, UserIcon, ShoppingBagIcon,
  UsersIcon, WarehouseIcon, BarChart3Icon, ClockIcon, CogIcon, Settings2Icon, WalletIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Belgilar shu yerda — server komponentdan client'ga faqat oddiy ma'lumot (href, nom) o'tadi
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "/stock": WarehouseIcon,
  "/machines": CogIcon,
  "/sales": ShoppingBagIcon,
  "/finance": WalletIcon,
  "/workers": UserIcon,
  "/attendance": ClockIcon,
  "/rolls": DiscIcon,
  "/production": HammerIcon,
  "/suppliers": TruckIcon,
  "/inventory": Package2Icon,
  "/warehouses": BoxIcon,
  "/sales/products": ShoppingBagIcon,
  "/customers": UsersIcon,
  "/reports": BarChart3Icon,
  "/history": HistoryIcon,
  "/settings": Settings2Icon,
}

export type NavItem = { href: string; label: string }

/** Joriy sahifaga eng uzun mos keladigan havola (masalan /sales/products — /sales emas) */
function activeHref(pathname: string, items: NavItem[]): string | null {
  let best: string | null = null
  for (const { href } of items) {
    if ((pathname === href || pathname.startsWith(`${href}/`)) && (!best || href.length > best.length)) best = href
  }
  return best
}

/** Katta ekranda — sarlavha qatorida, ostida chiziq bilan; kichikda — gorizontal aylanadigan qator */
export function NavLinks({ items, variant }: { items: NavItem[]; variant: "bar" | "scroll" }) {
  const pathname = usePathname()
  const current = activeHref(pathname, items)
  const activeRef = useRef<HTMLAnchorElement>(null)

  // Telefonda faol bo'lim ko'rinmay qolmasin
  useEffect(() => {
    if (variant === "scroll") activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" })
  }, [variant, current])

  return items.map(item => {
    const Icon = ICONS[item.href] ?? Package2Icon
    const active = item.href === current
    return (
      <Link
        key={item.href}
        ref={active ? activeRef : undefined}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2 text-sm font-semibold whitespace-nowrap transition-colors",
          variant === "bar"
            ? cn(
                "relative h-16 px-3 after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-full after:transition-colors",
                active ? "text-indigo-700 after:bg-indigo-600" : "text-gray-500 hover:text-gray-900 after:bg-transparent",
              )
            : cn(
                "h-9 px-3 rounded-full",
                active ? "bg-indigo-600 text-white" : "text-gray-600 bg-gray-100 hover:bg-gray-200/80",
              ),
        )}
      >
        <Icon className={cn("w-4 h-4 shrink-0", variant === "bar" && (active ? "text-indigo-600" : "text-gray-400"))} />
        {item.label}
      </Link>
    )
  })
}
