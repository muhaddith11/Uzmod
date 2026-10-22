import {
  getWorkerEarnings, getStaff, createEmployee, addAdjustment, deleteAdjustment,
  setEmployeeActive, resetEmployeePassword, changeEmployeeRole, setEmployeeDeviceId,
} from "@/lib/actions/workers"
import { getSessionUser } from "@/lib/session"
import { ActionForm } from "@/components/ui/action-form"
import { ActionButton } from "@/components/ui/action-button"
import { FormDialog } from "@/components/ui/form-dialog"
import { Field, NativeSelect, inputClass } from "@/components/ui/field"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DeleteButton } from "@/components/ui/delete-button"
import { PageHeader, pageClass } from "@/components/PageHeader"
import { DateRangeFilter } from "@/components/DateRangeFilter"
import { ExportButton } from "@/components/ExportButton"
import { getLocale, getT } from "@/i18n/server"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"
import { tashkentDateKey } from "@/lib/tz"
import { buildTimesheet, resolveRange } from "@/lib/attendance"
import { formatDuration } from "@/lib/domain/attendance"
import { UserIcon, BanknoteIcon, TrendingUpIcon, PlusIcon, UserPlusIcon, KeyRoundIcon, BanIcon, CheckCircleIcon, ShieldIcon, ScanFaceIcon } from "lucide-react"

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const me = await getSessionUser()
  const params = await searchParams
  // Sukut bo'yicha — shu oy (ish haqi odatda oylik hisoblanadi)
  const today = tashkentDateKey(new Date())
  const hasRange = params.from !== undefined || params.to !== undefined
  const range = hasRange ? params : { from: `${today.slice(0, 8)}01`, to: today }

  const [t, locale, staff, workers, timesheet] = await Promise.all([
    getT(), getLocale(), getStaff(), getWorkerEarnings(range), buildTimesheet(me.organizationId, resolveRange(range)),
  ])
  const attendanceByUser = new Map(timesheet.map(row => [row.userId, row]))
  const W = t.workers
  const activeWorkers = workers.filter(w => w.isActive)

  const canManage = (target: { id: string; role: string }) =>
    target.id !== me.id && (me.role === 'ADMIN' || target.role === 'WORKER')

  return (
    <div className={pageClass}>
      <PageHeader icon={<UserIcon className="text-indigo-600" />} title={W.title} subtitle={W.subtitle}>
        <ExportButton kind="workers" from={range.from} to={range.to} />
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        <div className="lg:col-span-1 space-y-8">
          <Card className="shadow-sm border-none bg-white">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlusIcon className="w-5 h-5 text-indigo-600" />
                {W.newEmployee}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={createEmployee} successMessage={W.employeeAdded} className="space-y-4">
                <Field label={W.fullName}>
                  <Input name="name" placeholder={W.fullNamePlaceholder} required className={inputClass} />
                </Field>
                <Field label={W.loginEmail}>
                  <Input name="email" type="email" placeholder="ishchi@example.com" required className={inputClass} />
                </Field>
                <Field label={W.password}>
                  <Input name="password" type="text" minLength={8} placeholder={W.passwordPlaceholder} required className={inputClass} autoComplete="off" />
                </Field>
                <Field label={W.role}>
                  <NativeSelect name="role" required>
                    <option value="WORKER">{W.roleWorker}</option>
                    {me.role === 'ADMIN' && <option value="MANAGER">{W.roleManager}</option>}
                  </NativeSelect>
                </Field>
                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold h-11">{W.addEmployee}</Button>
              </ActionForm>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-none bg-white">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PlusIcon className="w-5 h-5 text-indigo-600" />
                {W.adjustmentTitle}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={addAdjustment} successMessage={W.adjustmentSaved} className="space-y-4">
                <Field label={W.employee}>
                  <NativeSelect name="userId" required defaultValue="">
                    <option value="" disabled>{W.selectEmployee}</option>
                    {activeWorkers.map(w => <option key={w.id} value={w.id}>{w.name ?? w.email}</option>)}
                  </NativeSelect>
                </Field>
                <Field label={`${W.amount} (${t.common.currency})`}>
                  <Input name="amount" type="number" min="0" step="1" placeholder="50000" required className={inputClass} />
                </Field>
                <Field label={W.adjustmentType}>
                  <NativeSelect name="type" required>
                    <option value="BONUS">{W.bonus}</option>
                    <option value="PENALTY">{W.penalty}</option>
                  </NativeSelect>
                </Field>
                <Field label={t.common.note}>
                  <Input name="note" placeholder={W.reason} className={inputClass} />
                </Field>
                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold h-11">{t.common.confirm}</Button>
              </ActionForm>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-6 min-w-0">
          <Card className="shadow-sm border-none bg-white overflow-hidden">
            <CardHeader className="border-b border-gray-50">
              <CardTitle className="text-lg">{W.team(staff.length)}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="px-4 font-bold">{W.employee}</TableHead>
                    <TableHead className="px-4 font-bold">{W.role}</TableHead>
                    <TableHead className="px-4 font-bold">{t.common.status}</TableHead>
                    <TableHead className="px-4 font-bold text-right">{t.common.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map(s => {
                    const label = s.name ?? s.email
                    return (
                      <TableRow key={s.id} className={s.isActive ? "" : "bg-gray-50/80"}>
                        <TableCell className="px-4">
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-gray-900 truncate">
                              {label}{s.id === me.id && <span className="text-xs text-gray-400 font-medium"> ({W.you})</span>}
                            </span>
                            <span className="text-xs text-gray-400 truncate">{s.email}</span>
                            <span className={`text-[11px] ${s.telegramId ? "text-green-600" : "text-gray-400"}`}>
                              {s.telegramId ? W.telegramLinked : W.telegramNotLinked}
                            </span>
                            {s.deviceUserId && (
                              <span className="text-[11px] text-sky-700 font-bold">{W.deviceId}: {s.deviceUserId}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4">
                          <Badge variant="outline">{t.common.roles[s.role]}</Badge>
                        </TableCell>
                        <TableCell className="px-4">
                          <Badge variant="outline" className={s.isActive ? "bg-green-50 text-green-700 border-green-100" : "bg-gray-100 text-gray-500"}>
                            {s.isActive ? t.common.active : t.common.blocked}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {(canManage(s) || (me.role === 'ADMIN' && s.id === me.id)) && (
                              <FormDialog
                                triggerClassName="gap-1"
                                trigger={<><ScanFaceIcon className="w-3.5 h-3.5" />{W.deviceId}</>}
                                title={`${W.deviceId}: ${label}`}
                                description={W.deviceIdHint}
                                action={setEmployeeDeviceId}
                                submitLabel={t.common.save}
                              >
                                <input type="hidden" name="userId" value={s.id} />
                                <Field label={W.deviceId}>
                                  <Input name="deviceUserId" defaultValue={s.deviceUserId ?? ""} inputMode="numeric" className={inputClass} placeholder="12" />
                                </Field>
                              </FormDialog>
                            )}
                          {canManage(s) && (
                            <div className="contents">
                              {s.isActive ? (
                                <ActionButton
                                  action={setEmployeeActive.bind(null, s.id, false)}
                                  confirmText={W.confirmBlock(label)}
                                  className="text-rose-600 border-rose-100 hover:bg-rose-50 gap-1"
                                >
                                  <BanIcon className="w-3.5 h-3.5" /> {W.block}
                                </ActionButton>
                              ) : (
                                <ActionButton
                                  action={setEmployeeActive.bind(null, s.id, true)}
                                  confirmText={W.confirmUnblock(label)}
                                  className="text-green-700 border-green-100 hover:bg-green-50 gap-1"
                                >
                                  <CheckCircleIcon className="w-3.5 h-3.5" /> {W.unblock}
                                </ActionButton>
                              )}
                              <FormDialog
                                triggerClassName="gap-1"
              trigger={<><KeyRoundIcon className="w-3.5 h-3.5" />{W.resetPassword}</>}
                                title={`${W.resetPassword}: ${label}`}
                                action={resetEmployeePassword}
                                submitLabel={t.common.save}
                              >
                                <input type="hidden" name="userId" value={s.id} />
                                <Field label={W.password} hint={t.validation.passwordMin(8)}>
                                  <Input name="password" type="text" minLength={8} required className={inputClass} autoComplete="off" />
                                </Field>
                              </FormDialog>
                              {me.role === 'ADMIN' && (
                                <FormDialog
                                  triggerClassName="gap-1"
              trigger={<><ShieldIcon className="w-3.5 h-3.5" />{W.changeRole}</>}
                                  title={`${W.changeRole}: ${label}`}
                                  action={changeEmployeeRole}
                                  submitLabel={t.common.save}
                                >
                                  <input type="hidden" name="userId" value={s.id} />
                                  <Field label={W.role}>
                                    <NativeSelect name="role" defaultValue={s.role}>
                                      <option value="WORKER">{W.roleWorker}</option>
                                      <option value="MANAGER">{W.roleManager}</option>
                                      <option value="ADMIN">{W.roleAdmin}</option>
                                    </NativeSelect>
                                  </Field>
                                </FormDialog>
                              )}
                            </div>
                          )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <DateRangeFilter basePath="/workers" from={range.from} to={range.to} />
            <p className="text-xs text-gray-500 px-1">{W.periodHint}</p>
          </div>

          {workers.length === 0 && (
            <p className="text-center text-gray-400 italic py-10">{W.noWorkers}</p>
          )}

          {workers.map(worker => (
            <Card key={worker.id} className={`shadow-sm border-none bg-white overflow-hidden ${worker.isActive ? "" : "opacity-70"}`}>
              <div className="p-5 md:p-6 bg-gray-50/50 border-b flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 shrink-0">
                    <UserIcon className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-black text-gray-900 truncate">{worker.name ?? worker.email}</h3>
                    <p className="text-xs text-gray-500 font-bold truncate">{worker.email}</p>
                    {attendanceByUser.has(worker.id) && (() => {
                      const s = attendanceByUser.get(worker.id)!.summary
                      return (
                        <p className="text-xs text-gray-600 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>{t.attendance.colHours}: <b>{formatDuration(s.workedMinutes)}</b></span>
                          <span>{t.attendance.colPresent}: <b>{s.presentDays}/{s.workingDays}</b></span>
                          <span className={s.lateCount > 0 ? "text-amber-700" : ""}>{t.attendance.colLateCount}: <b>{s.lateCount}</b></span>
                          <span className={s.absentDays > 0 ? "text-rose-600" : ""}>{t.attendance.colAbsent}: <b>{s.absentDays}</b></span>
                        </p>
                      )
                    })()}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{W.balance}</p>
                  <p className={`text-2xl font-black ${worker.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatMoney(worker.balance, locale)}
                  </p>
                </div>
              </div>
              <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-2">
                  <div className="p-5 md:p-6 md:border-r border-gray-100">
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <TrendingUpIcon className="w-4 h-4 text-green-500" /> {W.pieceWork}
                      <span className="ml-auto text-gray-700 normal-case tracking-normal">{formatMoney(worker.pieceTotal, locale)}</span>
                    </h4>
                    <div className="space-y-3 max-h-72 overflow-y-auto">
                      {worker.work.map(m => (
                        <div key={m.id} className="flex justify-between items-center gap-3 text-sm">
                          <span className="text-gray-600 font-medium">
                            {m.productName} ({W.pieces(formatNumber(m.quantity, locale), m.unit)})
                            <span className="block text-[11px] text-gray-400">{formatDate(m.createdAt, locale)}</span>
                          </span>
                          <span className="font-bold text-gray-900 whitespace-nowrap">{formatMoney(m.earned, locale)}</span>
                        </div>
                      ))}
                      {worker.work.length === 0 && <p className="text-xs text-gray-400 italic">{W.noWork}</p>}
                    </div>
                  </div>
                  <div className="p-5 md:p-6 border-t md:border-t-0 border-gray-100">
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <BanknoteIcon className="w-4 h-4 text-blue-500" /> {W.extras}
                      <span className="ml-auto text-gray-700 normal-case tracking-normal">{formatMoney(worker.adjustmentTotal, locale)}</span>
                    </h4>
                    <div className="space-y-3 max-h-72 overflow-y-auto">
                      {worker.adjustments.map(a => (
                        <div key={a.id} className="flex justify-between items-center gap-2 text-sm">
                          <div className="flex flex-col min-w-0">
                            <span className="text-gray-600 font-medium truncate">{a.note || (a.type === 'BONUS' ? W.bonus : W.penalty)}</span>
                            <span className="text-[11px] text-gray-400">{formatDate(a.createdAt, locale)}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`font-bold ${a.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {a.amount > 0 ? "+" : ""}{formatMoney(a.amount, locale)}
                            </span>
                            <DeleteButton
                              action={deleteAdjustment.bind(null, a.id)}
                              confirmText={W.confirmDeleteAdjustment}
                              className="h-7 w-7 text-gray-300 hover:text-red-500"
                              iconClassName="w-3.5 h-3.5"
                            />
                          </div>
                        </div>
                      ))}
                      {worker.adjustments.length === 0 && <p className="text-xs text-gray-400 italic">{W.noExtras}</p>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
