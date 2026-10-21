import { prisma } from "@/lib/prisma"
import { getOrgId } from "@/lib/session"
import { parseDateRange } from "@/lib/date-range"
import { DateRangeFilter } from "@/components/DateRangeFilter"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { HistoryIcon, ArrowUpRightIcon, ArrowDownLeftIcon, HammerIcon, RefreshCcwIcon } from "lucide-react"

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const orgId = await getOrgId()
  const { from, to } = await searchParams
  const createdAt = parseDateRange({ from, to })

  const movements = await prisma.stockMovement.findMany({
    where: {
      organizationId: orgId,
      ...(createdAt ? { createdAt } : {}),
    },
    include: {
      product: true,
      fromWarehouse: true,
      toWarehouse: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  })

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-gray-900">
          <HistoryIcon className="w-8 h-8 text-gray-400" />
          Harakatlar Tarixi
        </h1>
        <p className="text-gray-500">Ombordagi barcha kirim, chiqim va ishlab chiqarish operatsiyalari auditi</p>
      </div>

      <DateRangeFilter basePath="/history" from={from} to={to} />

      <p className="text-xs text-gray-400 -mt-4">
        Eng so'nggi 100 ta operatsiya ko'rsatiladi{createdAt ? " (tanlangan davr ichida)" : ""}.
      </p>

      <Card className="shadow-sm border-none bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-none">
                <TableHead className="py-4 px-6 font-bold">Sana</TableHead>
                <TableHead className="py-4 px-6 font-bold">Tur</TableHead>
                <TableHead className="py-4 px-6 font-bold">Mahsulot / SKU</TableHead>
                <TableHead className="py-4 px-6 font-bold">Miqdor</TableHead>
                <TableHead className="py-4 px-6 font-bold">Kimdan / Kimga</TableHead>
                <TableHead className="py-4 px-6 font-bold">Izoh</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((m) => (
                <TableRow key={m.id} className="hover:bg-gray-50/50">
                  <TableCell className="py-4 px-6 text-sm text-gray-500 font-medium">
                    {new Date(m.createdAt).toLocaleString('uz-UZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell className="py-4 px-6">
                    <MovementBadge type={m.type} />
                  </TableCell>
                  <TableCell className="py-4 px-6">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900">{m.product.name}</span>
                      <span className="text-[10px] text-gray-400 font-bold uppercase">{m.product.sku || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className={`py-4 px-6 font-black ${m.quantity > 0 ? "text-green-600" : "text-red-500"}`}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity} {m.product.unit}
                  </TableCell>
                  <TableCell className="py-4 px-6">
                    <div className="text-xs space-y-1 font-medium">
                      {m.fromWarehouse && <div className="text-red-400">Dan: {m.fromWarehouse.name}</div>}
                      {m.toWarehouse && <div className="text-green-600">Ga: {m.toWarehouse.name}</div>}
                    </div>
                  </TableCell>
                  <TableCell className="py-4 px-6 text-sm text-gray-400 italic max-w-xs truncate">
                    {m.note || "—"}
                  </TableCell>
                </TableRow>
              ))}
              {movements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center text-gray-400 italic">
                    Hali harakatlar qayd etilmagan
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function MovementBadge({ type }: { type: string }) {
  switch (type) {
    case 'IN':
      return <Badge className="bg-green-50 text-green-700 border-green-100"><ArrowDownLeftIcon className="w-3 h-3 mr-1" /> Kirim</Badge>
    case 'OUT':
      return <Badge className="bg-red-50 text-red-700 border-red-100"><ArrowUpRightIcon className="w-3 h-3 mr-1" /> Chiqim</Badge>
    case 'PRODUCTION':
      return <Badge className="bg-purple-50 text-purple-700 border-purple-100"><HammerIcon className="w-3 h-3 mr-1" /> Ish.Chiq</Badge>
    case 'TRANSFER':
      return <Badge className="bg-blue-50 text-blue-700 border-blue-100"><RefreshCcwIcon className="w-3 h-3 mr-1" /> Transfer</Badge>
    default:
      return <Badge>{type}</Badge>
  }
}
