import { getYarnStock } from "@/lib/actions/yarn"
import { getStockOverview, markDefect, recordWaste } from "@/lib/actions/batches"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FormDialog } from "@/components/ui/form-dialog"
import { Input } from "@/components/ui/input"
import { Field, inputClass } from "@/components/ui/field"
import { YarnReceiveForm } from "@/components/yarn/YarnReceiveForm"
import { YarnCalculator } from "@/components/yarn/YarnCalculator"
import { PageHeader, pageClass } from "@/components/PageHeader"
import { ExportButton } from "@/components/ExportButton"
import { getLocale, getT } from "@/i18n/server"
import { formatDayTime, formatNumber } from "@/lib/format"
import { colorHex } from "@/lib/domain/machines"
import { WarehouseIcon, PlusIcon, CalculatorIcon, PackageCheckIcon, CogIcon } from "lucide-react"

export default async function StockPage() {
  const [t, locale, yarn, overview] = await Promise.all([getT(), getLocale(), getYarnStock(), getStockOverview()])
  const S = t.stock
  const Y = t.yarn
  const fmt = (n: number) => formatNumber(n, locale)

  const types = [...new Set([...Y.defaultTypes, ...yarn.map(s => s.yarnType)])].filter(Boolean)
  const colors = [...new Set([...Y.defaultColors, ...yarn.map(s => s.color)])].filter(Boolean)
  const visibleYarn = yarn.filter(y => y.stockKg !== 0 || y.todayKg > 0 || y.knittingKg > 0)

  return (
    <div className={pageClass}>
      <PageHeader icon={<WarehouseIcon className="text-teal-600" />} title={S.title} subtitle={S.subtitle}>
        <ExportButton kind="stock" />
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Total label={S.yarnTotal} kg={fmt(overview.yarnKg)} tone="teal" />
        <Total label={S.finishedTotal} kg={fmt(overview.finishedKg)} sub={S.approxSocks(fmt(overview.finishedSocks))} tone="indigo" />
        <Total label={S.defectTotal} kg={fmt(overview.defectKg)} tone="rose" />
        <Total label={S.wasteTotal} kg={fmt(overview.wasteKg)} tone="stone" />
      </div>

      {overview.knitting.machines > 0 && (
        <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-100 p-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-amber-900">
          <span className="flex items-center gap-2 font-black"><CogIcon className="w-4 h-4 text-amber-600" />{S.knittingTitle}</span>
          <span>{S.knittingLine(fmt(overview.knitting.kg), fmt(overview.knitting.socks), overview.knitting.machines)}</span>
          {overview.knitting.nextReadyAt && <span className="text-amber-800">{S.nextReady(formatDayTime(overview.knitting.nextReadyAt))}</span>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><PlusIcon className="w-5 h-5 text-teal-600" />{Y.receiveTitle}</CardTitle>
            <CardDescription>{Y.receiveHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <YarnReceiveForm types={types} colors={colors} />
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-6 min-w-0">
          <Card className="overflow-hidden pb-0">
            <CardHeader>
              <CardTitle className="text-lg">{S.yarnTitle}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead className="px-5">{Y.type}</TableHead>
                    <TableHead className="px-4">{Y.color}</TableHead>
                    <TableHead className="px-4 text-right">{Y.colStock}</TableHead>
                    <TableHead className="px-4 text-right">{Y.colToday}</TableHead>
                    <TableHead className="px-5 text-right">{Y.colKnitting}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleYarn.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="px-5 font-bold text-gray-900">{s.yarnType}</TableCell>
                      <TableCell className="px-4">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full border border-gray-300" style={{ background: colorHex(s.color) }} />
                          {s.color}
                        </span>
                      </TableCell>
                      <TableCell className={`px-4 text-right font-mono font-black ${s.stockKg <= 0 ? "text-rose-600" : "text-gray-900"}`}>{fmt(s.stockKg)}</TableCell>
                      <TableCell className="px-4 text-right font-mono text-teal-700">{s.todayKg > 0 ? `+${fmt(s.todayKg)}` : t.common.none}</TableCell>
                      <TableCell className="px-5 text-right font-mono text-gray-500">{s.knittingKg > 0 ? fmt(s.knittingKg) : t.common.none}</TableCell>
                    </TableRow>
                  ))}
                  {visibleYarn.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="h-28 text-center text-gray-500">{Y.noYarn}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {visibleYarn.some(s => s.stockKg > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><CalculatorIcon className="w-5 h-5 text-indigo-600" />{Y.calcTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <YarnCalculator yarns={visibleYarn.filter(s => s.stockKg > 0).map(s => ({ id: s.id, name: s.name, color: s.color, stockKg: s.stockKg }))} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card className="overflow-hidden pb-0">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><PackageCheckIcon className="w-5 h-5 text-indigo-600" />{S.batchesTitle}</CardTitle>
          <CardDescription>{S.batchesHint}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="px-5">{S.colBatch}</TableHead>
                <TableHead className="px-4 text-right">{S.colFinished}</TableHead>
                <TableHead className="px-4 text-right">{S.colSocks}</TableHead>
                <TableHead className="px-4 text-right">{S.colDefect}</TableHead>
                <TableHead className="px-4 text-right">{S.colWaste}</TableHead>
                <TableHead className="px-4 text-right">{S.colProduced}</TableHead>
                <TableHead className="px-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.batches.map(b => (
                <TableRow key={b.id}>
                  <TableCell className="px-5 font-bold text-gray-900">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full border border-gray-300 shrink-0" style={{ background: colorHex(b.yarnColor) }} />
                      {b.label}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 text-right font-mono font-black">{fmt(b.finishedKg)}</TableCell>
                  <TableCell className="px-4 text-right font-mono text-gray-500">{fmt(b.finishedSocks)}</TableCell>
                  <TableCell className={`px-4 text-right font-mono ${b.defectKg > 0 ? "text-rose-600 font-bold" : "text-gray-400"}`}>{fmt(b.defectKg)}</TableCell>
                  <TableCell className={`px-4 text-right font-mono ${b.wasteKg > 0 ? "text-stone-700 font-bold" : "text-gray-400"}`}>{fmt(b.wasteKg)}</TableCell>
                  <TableCell className="px-4 text-right font-mono text-gray-500">{fmt(b.producedKg)}</TableCell>
                  <TableCell className="px-5">
                    {b.finishedKg > 0 && (
                      <div className="flex justify-end gap-1.5">
                        <FormDialog
                          trigger={S.markWaste}
                          triggerClassName="text-stone-700 border-stone-200 hover:bg-stone-50"
                          title={`${S.wasteTitle}: ${b.label}`}
                          description={S.wasteHint(`${fmt(b.finishedKg)} kg`)}
                          action={recordWaste}
                          submitLabel={S.wasteSubmit}
                          submitClassName="bg-stone-700 hover:bg-stone-800 text-white"
                        >
                          <input type="hidden" name="batchId" value={b.id} />
                          <Field label={S.wasteKg}>
                            <Input name="kg" type="number" step="0.01" min="0" max={b.finishedKg} required inputMode="decimal" className={inputClass} />
                          </Field>
                          <Field label={t.common.note}>
                            <Input name="note" className={inputClass} placeholder={t.common.notePlaceholder} />
                          </Field>
                        </FormDialog>
                        <FormDialog
                          trigger={S.markDefect}
                          triggerClassName="text-rose-600 border-rose-200 hover:bg-rose-50"
                          title={`${S.defectTitle}: ${b.label}`}
                          description={S.defectHint(`${fmt(b.finishedKg)} kg`)}
                          action={markDefect}
                          submitLabel={S.defectSubmit}
                          submitClassName="bg-rose-600 hover:bg-rose-700 text-white"
                        >
                          <input type="hidden" name="batchId" value={b.id} />
                          <Field label={S.defectKg}>
                            <Input name="kg" type="number" step="0.01" min="0" max={b.finishedKg} required inputMode="decimal" className={inputClass} />
                          </Field>
                          <Field label={t.common.note}>
                            <Input name="note" className={inputClass} placeholder={t.common.notePlaceholder} />
                          </Field>
                        </FormDialog>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {overview.batches.length === 0 && (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-gray-500">{S.noBatches}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

const TONES = {
  teal: "bg-teal-50 ring-teal-100 text-teal-900",
  indigo: "bg-indigo-50 ring-indigo-100 text-indigo-900",
  rose: "bg-rose-50 ring-rose-100 text-rose-900",
  stone: "bg-stone-100 ring-stone-200 text-stone-900",
} as const

function Total({ label, kg, sub, tone }: { label: string; kg: string; sub?: string; tone: keyof typeof TONES }) {
  return (
    <div className={`rounded-2xl ring-1 p-5 ${TONES[tone]}`}>
      <p className="text-sm font-bold opacity-80">{label}</p>
      <p className="text-2xl md:text-3xl font-black mt-1 tabular-nums">{kg} <span className="text-lg font-bold opacity-60">kg</span></p>
      {sub && <p className="text-sm font-semibold opacity-75">{sub}</p>}
    </div>
  )
}
