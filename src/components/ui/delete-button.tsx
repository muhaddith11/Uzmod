'use client'

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Trash2Icon } from "lucide-react"

interface DeleteButtonProps {
  action: () => Promise<void>
  confirmText?: string
  size?: "icon" | "sm" | "default"
  className?: string
  iconClassName?: string
}

export function DeleteButton({
  action,
  confirmText = "O'chirishni tasdiqlaysizmi?",
  size = "icon",
  className = "text-gray-400 hover:text-rose-600 hover:bg-rose-50",
  iconClassName = "w-4 h-4",
}: DeleteButtonProps) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm(confirmText)) return
    startTransition(async () => {
      await action()
    })
  }

  return (
    <Button
      variant="ghost"
      size={size}
      className={className}
      onClick={handleClick}
      disabled={isPending}
    >
      <Trash2Icon className={iconClassName} />
    </Button>
  )
}
