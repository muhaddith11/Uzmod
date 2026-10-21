'use client'

import { Trash2Icon } from "lucide-react"
import { ActionButton } from "@/components/ui/action-button"
import { useT } from "@/i18n/client"
import type { ActionResult } from "@/lib/action"

export function DeleteButton({
  action,
  confirmText,
  className = "text-gray-400 hover:text-rose-600 hover:bg-rose-50",
  iconClassName = "w-4 h-4",
}: {
  action: () => Promise<ActionResult>
  confirmText?: string
  className?: string
  iconClassName?: string
}) {
  const t = useT()
  return (
    <ActionButton
      action={action}
      confirmText={confirmText ?? t.common.confirmDelete}
      variant="ghost"
      size="icon"
      className={className}
      title={t.common.delete}
    >
      <Trash2Icon className={iconClassName} />
    </ActionButton>
  )
}
