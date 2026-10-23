/** Sahifa sarlavhasi: belgi, nom, izoh va o'ng tomonda amallar (masalan, Word hisobot) */
export function PageHeader({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <span className="shrink-0 grid place-items-center w-12 h-12 rounded-2xl bg-white ring-1 ring-gray-200/80 shadow-[0_1px_2px_0_rgb(16_24_40/0.04)] [&_svg]:w-6 [&_svg]:h-6">{icon}</span>
        <div className="min-w-0">
          <h1 className="text-2xl md:text-[1.75rem] font-black tracking-tight text-gray-900 text-balance">{title}</h1>
          {subtitle && <p className="text-sm md:text-base text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap gap-2 shrink-0">{children}</div>}
    </div>
  )
}

export const pageClass = "p-4 md:p-8 max-w-7xl mx-auto space-y-8"
