'use client'

import { useState, useTransition } from "react"
import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ActionResult } from "@/lib/action"

/**
 * Server action'ni chaqiradigan forma. Action qaytargan xatoni forma tepasida
 * ko'rsatadi (production'da ham), muvaffaqiyatda maydonlarni tozalaydi.
 * onSubmit ishlatiladi: <form action> React 19'da xatoda ham maydonlarni tozalab yuborardi.
 */
export function ActionForm({
  action,
  className,
  successMessage,
  children,
}: {
  action: (formData: FormData) => Promise<ActionResult>
  className?: string
  successMessage?: string
  children: React.ReactNode
}) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const result = await action(formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      form.reset()
      setSuccess(true)
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={isPending}
      className={cn(className, isPending && "opacity-60 pointer-events-none")}
    >
      {error && (
        <div className="col-span-full rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 font-medium flex items-start gap-2">
          <AlertTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && successMessage && (
        <div className="col-span-full rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-700 font-medium flex items-start gap-2">
          <CheckCircle2Icon className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {children}
    </form>
  )
}
