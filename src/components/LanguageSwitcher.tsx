'use client'

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { setLocale } from "@/lib/actions/locale"
import { useLocale, useT } from "@/i18n/client"
import { LOCALES } from "@/i18n/locales"
import { cn } from "@/lib/utils"

const LABELS = { uz: "O'z", ru: "Рус" } as const

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale()
  const t = useT()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <div
      role="group"
      aria-label={t.common.language}
      className={cn("inline-flex rounded-lg bg-gray-100 p-0.5", isPending && "opacity-60", className)}
    >
      {LOCALES.map(code => (
        <button
          key={code}
          type="button"
          aria-pressed={code === locale}
          disabled={isPending}
          onClick={() => {
            if (code === locale) return
            startTransition(async () => {
              await setLocale(code)
              router.refresh()
            })
          }}
          className={cn(
            "px-2 py-1 rounded-md text-xs font-bold transition-colors",
            code === locale ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-800"
          )}
        >
          {LABELS[code]}
        </button>
      ))}
    </div>
  )
}
