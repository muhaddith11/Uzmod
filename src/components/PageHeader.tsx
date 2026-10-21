/** Sahifa sarlavhasi: belgi, nom, izoh va o'ng tomonda amallar (masalan, eksport) */
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
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div className="space-y-1 min-w-0">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2 text-gray-900">
          <span className="shrink-0 [&_svg]:w-7 [&_svg]:h-7 md:[&_svg]:w-8 md:[&_svg]:h-8">{icon}</span>
          {title}
        </h1>
        {subtitle && <p className="text-gray-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2 shrink-0">{children}</div>}
    </div>
  )
}

export const pageClass = "p-4 md:p-8 max-w-7xl mx-auto space-y-8"
