'use client'

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { ActionForm } from "@/components/ui/action-form"
import { cn } from "@/lib/utils"
import type { ActionResult } from "@/lib/action"

/**
 * Tugma → dialog ichida forma. Muvaffaqiyatli saqlangach dialog o'zi yopiladi.
 */
export function FormDialog({
  trigger,
  triggerClassName,
  title,
  description,
  action,
  submitLabel,
  submitClassName,
  children,
}: {
  // Tugma ichidagi belgi va matn. Tugmaning o'zi DialogTrigger — render orqali
  // boshqa komponentga o'ralmaydi (server/client'da atributlar farq qilmasin)
  trigger: React.ReactNode
  triggerClassName?: string
  title: string
  description?: string
  action: (formData: FormData) => Promise<ActionResult>
  submitLabel: string
  submitClassName?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }), triggerClassName)}>
        {trigger}
      </DialogTrigger>
      <DialogContent className="bg-white sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-black text-gray-900 pr-6">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <ActionForm action={action} onSuccess={() => setOpen(false)} className="space-y-4 pt-2">
          {children}
          <Button type="submit" className={cn("w-full h-11 font-bold", submitClassName ?? "bg-indigo-600 hover:bg-indigo-700 text-white")}>
            {submitLabel}
          </Button>
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}
