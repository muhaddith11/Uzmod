import { requireModule } from "@/lib/modules"
import type { MovementType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getSessionUser, isManagement } from "@/lib/session"
import { parseDateRange } from "@/lib/tz"
import { DateRangeFilter } from "@/components/DateRangeFilter"
import { ExportButton } from "@/components/ExportButton"
import { PageHeader, pageClass } from "@/components/PageHeader"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getLocale, getT } from "@/i18n/server"
import { formatDateTime, formatNumber } from "@/lib/format"
import { HistoryIcon } from "lucide-react"

const LIMIT = 200

const TYPE_CLASS: Record<MovementType, string> = {
  IN: "bg-green-50 text-green-700 border-green-100",
  OUT: "bg-red-50 text-red-700 border-red-100",
  PRODUCTION: "bg-purple-50 text-purple-700 border-purple-100",
  TRANSFER: "bg-sky-50 text-sky-700 border-sky-100",
  ADJUSTMENT: "bg-gray-100 text-gray-700 border-gray-200",
  WASTAGE: "bg-orange-50 text-orange-700 border-orange-100",
  REVISION: "bg-emerald-50 text-emerald-700 border-emerald-100",
  RETURN: "bg-amber-50 text-amber-700 border-amber-100",
  TO_MACHINE: "bg-indigo-50 text-indigo-700 border-indigo-100",
  FROM_MACHINE: "bg-teal-50 text-teal-700 border-teal-100",
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  await requireModule("legacy")
  const me = await getSessionUser()
  const { from, to } = await searchParams
  const createdAt = parseDateRange({ from, to })
  const [t, locale] = await Promise.all([getT(), getLocale()])
  const H = t.history

  const movements = await prisma.stockMovement.findMany({
    where: { organizationId: me.organizationId, ...(createdAt ? { createdAt } : {}) },
    include: {
      product: { select: { name: true, sku: true, unit: true } },
      fromWarehouse: { select: { name: true } },
      toWarehouse: { select: { name: true } },
      creator: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: LIMIT
  })

  // Ishchiga sotuv summalari ko'rsatilmaydi (izohda narxlar bor)
  const showNotes = isManagement(me.role)

  return (
    <div className={pageClass}>
      <PageHeader icon={<HistoryIcon className="text-gray-400" />} title={H.title} subtitle={H.subtitle}>
        {showNotes && <ExportButton kind="movements" from={from} to={to} />}
      </PageHeader>

      <DateRangeFilter basePath="/history" from={from} to={to} />
      {movements.length === LIMIT && <p className="text-xs text-gray-400 -mt-4">{H.showingLast(LIMIT)}</p>}

      <Card className="overflow-hidden pb-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-none">
                <TableHead className="py-4 px-4">{t.common.date}</TableHead>
                <TableHead className="py-4 px-4">{H.colType}</TableHead>
                <TableHead className="py-4 px-4">{H.colProduct}</TableHead>
                <TableHead className="py-4 px-4">{H.colQty}</TableHead>
                <TableHead className="py-4 px-4">{H.colRoute}</TableHead>
                {showNotes && <TableHead className="py-4 px-4">{H.colNote}</TableHead>}
                <TableHead className="py-4 px-4">{H.colWho}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map(m => (
                <TableRow key={m.id} className="hover:bg-gray-50/50">
                  <TableCell className="py-3 px-4 text-xs text-gray-500 font-medium whitespace-nowrap">{formatDateTime(m.createdAt, locale)}</TableCell>
                  <TableCell className="py-3 px-4">
                    <Badge variant="outline" className={TYPE_CLASS[m.type]}>{H.types[m.type]}</Badge>
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900">{m.product.name}</span>
                      {m.product.sku && <span className="text-[11px] text-gray-400 font-bold uppercase">{m.product.sku}</span>}
                    </div>
                  </TableCell>
                  <TableCell className={`py-3 px-4 font-black whitespace-nowrap ${m.type === 'TRANSFER' ? "text-sky-700" : m.quantity > 0 ? "text-green-600" : "text-red-500"}`}>
                    {m.quantity > 0 && m.type !== 'TRANSFER' ? "+" : ""}{formatNumber(m.quantity, locale)} {m.product.unit}
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <div className="text-xs space-y-0.5 font-medium">
                      {m.fromWarehouse && <div className="text-red-500">↑ {m.fromWarehouse.name}</div>}
                      {m.toWarehouse && <div className="text-green-600">↓ {m.toWarehouse.name}</div>}
                    </div>
                  </TableCell>
                  {showNotes && (
                    <TableCell className="py-3 px-4 text-sm text-gray-500 max-w-xs">{m.note || t.common.none}</TableCell>
                  )}
                  <TableCell className="py-3 px-4 text-xs text-gray-500">{m.creator?.name ?? m.creator?.email ?? t.common.none}</TableCell>
                </TableRow>
              ))}
              {movements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={showNotes ? 7 : 6} className="h-48 text-center text-gray-400 italic">{H.empty}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
