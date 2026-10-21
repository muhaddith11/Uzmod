'use client'

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import type { ActionResult } from "@/lib/action"

/**
 * Bitta bosish bilan server action (tasdiq so'rab). Xato bo'lsa sababini ko'rsatadi —
 * masalan: "Omborda mahsulot bor".
 */
export function ActionButton({
  action,
  confirmText,
  children,
  variant = "outline",
  size = "sm",
  className,
  title,
}: {
  action: () => Promise<ActionResult>
  confirmText?: string
  children: React.ReactNode
  variant?: "outline" | "ghost" | "default" | "destructive" | "secondary"
  size?: "sm" | "default" | "icon" | "icon-sm" | "xs"
  className?: string
  title?: string
}) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (confirmText && !confirm(confirmText)) return
    startTransition(async () => {
      const result = await action()
      if (result.error) alert(result.error)
    })
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={isPending}
      title={title}
      aria-label={title}
    >
      {children}
    </Button>
  )
}
