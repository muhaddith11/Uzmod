import { cn } from "@/lib/utils"

/** Forma maydoni: yorliq + kiritish + ixtiyoriy izoh */
export function Field({
  label,
  hint,
  htmlFor,
  className,
  children,
}: {
  label: React.ReactNode
  hint?: React.ReactNode
  htmlFor?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-gray-700 block">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

/** Oddiy <select> — mobil qurilmalarda tizim tanlovchisi ochiladi */
export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "w-full h-11 px-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 text-sm",
        "focus:outline-none focus:ring-3 focus:ring-indigo-500/30 focus:border-indigo-400",
        className
      )}
      {...props}
    />
  )
}

export const inputClass = "bg-gray-50 border-gray-200 h-11"
