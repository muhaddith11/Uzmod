'use client'

import { useRef, useState, useTransition } from "react"
import { createEmployee } from "@/lib/actions/workers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react"

export function EmployeeForm({ canAddManager }: { canAddManager: boolean }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      try {
        await createEmployee(formData)
        setSuccess(`${formData.get("name")} qo'shildi. Endi u email va parol bilan kira oladi.`)
        formRef.current?.reset()
      } catch (e: any) {
        setError(e?.message ?? "Xatolik yuz berdi")
      }
    })
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-bold text-gray-700">Ism-sharif</label>
        <Input name="name" placeholder="Masalan: Anvar Tikuvchi" required className="bg-gray-50 h-11" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-bold text-gray-700">Email (login)</label>
        <Input name="email" type="email" placeholder="ishchi@example.com" required className="bg-gray-50 h-11" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-bold text-gray-700">Parol</label>
        <Input name="password" type="text" minLength={6} placeholder="Kamida 6 ta belgi" required className="bg-gray-50 h-11" />
      </div>
      <div className="space-y-2 text-black">
        <label className="text-sm font-bold text-gray-700">Lavozim</label>
        <select name="role" required className="w-full p-3 border rounded-xl bg-gray-50">
          <option value="WORKER">Ishchi (Tikuvchi)</option>
          {canAddManager && <option value="MANAGER">Menejer</option>}
        </select>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 font-medium flex items-start gap-2">
          <AlertTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-700 font-medium flex items-start gap-2">
          <CheckCircle2Icon className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold h-11 disabled:opacity-60"
      >
        {isPending ? "Qo'shilmoqda..." : "Xodim qo'shish"}
      </Button>
    </form>
  )
}
