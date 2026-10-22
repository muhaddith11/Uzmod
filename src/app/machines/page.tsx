import { createMachines, getLoadFormOptions, getMachineReport, getMachinesBoard } from "@/lib/actions/machines"
import { getSessionUser, isManagement } from "@/lib/session"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ActionForm } from "@/components/ui/action-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, inputClass } from "@/components/ui/field"
import { MachineBoard } from "@/components/machines/MachineBoard"
import { LoadMachinesForm } from "@/components/machines/LoadMachinesForm"
import { PageHeader, pageClass } from "@/components/PageHeader"
import { DateRangeFilter } from "@/components/DateRangeFilter"
import { getLocale, getT } from "@/i18n/server"
import { formatNumber } from "@/lib/format"
import { colorHex } from "@/lib/domain/machines"
import { tashkentDateKey } from "@/lib/tz"
import { CogIcon, PlayIcon, PlusIcon, BarChart3Icon } from "lucide-react"

export default async function MachinesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const me = await getSessionUser()
  const manager = isManagement(me.role)
  const params = await searchParams
  const today = tashkentDateKey(new Date())
  const range = params.from || params.to ? params : { from: today, to: today }

  const [t, locale, board, options, report] = await Promise.all([
    getT(), getLocale(), getMachinesBoard(), getLoadFormOptions(), manager ? getMachineReport(range) : Promise.resolve(null),
  ])
  const M = t.machines
  const fmt = (n: number) => formatNumber(n, locale)

  return (
    <div className={pageClass}>
      <PageHeader icon={<CogIcon className="text-indigo-600" />} title={M.title} subtitle={M.subtitle} />

      {board.machines.length === 0 ? (
        <Card className="shadow-sm border-none bg-white">
          <CardContent className="pt-6 space-y-4">
            <p className="text-gray-500">{M.noMachines}</p>
            {me.role === "ADMIN" && <AddMachinesForm t={t} />}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
          <Card className="xl:col-span-2 shadow-sm border-none bg-white min-w-0">
            <CardContent className="pt-6">
              <MachineBoard board={board} options={options} canManage={manager} />
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-sm border-none bg-white">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><PlayIcon className="w-5 h-5 text-green-600" />{M.loadTitle}</CardTitle>
                <CardDescription>{M.loadHint(board.autoTransferHours)}</CardDescription>
              </CardHeader>
              <CardContent>
                <LoadMachinesForm options={options} />
              </CardContent>
            </Card>
            {me.role === "ADMIN" && (
              <Card className="shadow-sm border-none bg-white">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><PlusIcon className="w-5 h-5 text-indigo-600" />{M.addTitle}</CardTitle>
                </CardHeader>
                <CardContent><AddMachinesForm t={t} /></CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {report && (
        <section className="space-y-4">
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2"><BarChart3Icon className="w-5 h-5 text-indigo-600" />{M.reportTitle}</h2>
          <DateRangeFilter basePath="/machines" from={range.from} to={range.to} allowAllTime={false} />
          <p className="text-xs text-gray-500 px-1 -mt-2">{M.reportHint}</p>
          <Card className="shadow-sm border-none bg-white overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="px-4 font-bold">{M.colMachine}</TableHead>
                    <TableHead className="px-4 font-bold">{M.colYarn}</TableHead>
                    <TableHead className="px-4 font-bold text-right">{M.colGram}</TableHead>
                    <TableHead className="px-4 font-bold text-right">{M.colKg}</TableHead>
                    <TableHead className="px-4 font-bold text-right">{M.colSocks}</TableHead>
                    <TableHead className="px-4 font-bold">{M.colStatus}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map(r => (
                    <TableRow key={`${r.machineNumber}-${r.yarnName}-${r.gramsPerSock}`}>
                      <TableCell className="px-4 font-black">{r.machineNumber}<span className="text-[11px] text-gray-400 font-normal ml-1">{r.group}</span></TableCell>
                      <TableCell className="px-4 text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full border border-gray-300" style={{ background: colorHex(r.yarnColor) }} />
                          {r.yarnName}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 text-right">{r.gramsPerSock}</TableCell>
                      <TableCell className="px-4 text-right font-mono">{fmt(r.kg)}</TableCell>
                      <TableCell className="px-4 text-right font-mono font-bold">{fmt(r.socks)}</TableCell>
                      <TableCell className={`px-4 text-xs font-bold ${r.knitting ? "text-amber-600" : "text-green-700"}`}>
                        {r.knitting ? M.statusKnitting : M.statusDone}
                      </TableCell>
                    </TableRow>
                  ))}
                  {report.rows.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-gray-400 italic">{M.noLoads}</TableCell></TableRow>
                  ) : (
                    <TableRow className="bg-gray-50 font-black">
                      <TableCell className="px-4" colSpan={3}>{M.totals} · {M.machinesCount(report.machines)}</TableCell>
                      <TableCell className="px-4 text-right font-mono">{fmt(report.totals.kg)}</TableCell>
                      <TableCell className="px-4 text-right font-mono">{fmt(report.totals.socks)}</TableCell>
                      <TableCell className="px-4" />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  )
}

function AddMachinesForm({ t }: { t: Awaited<ReturnType<typeof getT>> }) {
  const M = t.machines
  return (
    <ActionForm action={createMachines} successMessage={M.added} className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Field label={M.fromNumber}>
          <Input name="from" type="number" min="1" step="1" required className={inputClass} placeholder="1" />
        </Field>
        <Field label={M.toNumber}>
          <Input name="to" type="number" min="1" step="1" required className={inputClass} placeholder="53" />
        </Field>
        <Field label={M.group}>
          <Input name="group" required maxLength={30} className={inputClass} placeholder={M.groupPlaceholder} />
        </Field>
      </div>
      <Button type="submit" className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold">{t.common.add}</Button>
    </ActionForm>
  )
}
