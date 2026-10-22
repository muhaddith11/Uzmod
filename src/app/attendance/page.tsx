import {
  getAttendanceRecords, getTimesheet, getTodayBoard, getWorkSchedule, saveAttendance, deleteAttendance, type BoardState,
} from "@/lib/actions/attendance"
import { getSessionUser } from "@/lib/session"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { FormDialog } from "@/components/ui/form-dialog"
import { DeleteButton } from "@/components/ui/delete-button"
import { Field, NativeSelect, inputClass } from "@/components/ui/field"
import { ScheduleForm } from "@/components/attendance/ScheduleForm"
import { PageHeader, pageClass } from "@/components/PageHeader"
import { DateRangeFilter } from "@/components/DateRangeFilter"
import { ExportButton } from "@/components/ExportButton"
import { getLocale, getT } from "@/i18n/server"
import type { Messages } from "@/i18n/messages"
import { formatDate, formatNumber } from "@/lib/format"
import { formatDuration } from "@/lib/domain/attendance"
import { tashkentDateKey, tashkentTimeKey } from "@/lib/tz"
import { ClockIcon, PencilIcon, PlusIcon, Settings2Icon, UsersIcon, AlarmClockIcon, UserXIcon, StethoscopeIcon } from "lucide-react"

const STATE_CLASS: Record<BoardState, string> = {
  inWork: "bg-green-50 text-green-700 border-green-100",
  left: "bg-gray-100 text-gray-600 border-gray-200",
  absent: "bg-rose-50 text-rose-700 border-rose-100",
  notYet: "bg-amber-50 text-amber-700 border-amber-100",
  dayOff: "bg-gray-50 text-gray-400 border-gray-100",
  SICK: "bg-sky-50 text-sky-700 border-sky-100",
  VACATION: "bg-sky-50 text-sky-700 border-sky-100",
  EXCUSED: "bg-sky-50 text-sky-700 border-sky-100",
}

function stateLabel(t: Messages, state: BoardState) {
  const A = t.attendance
  switch (state) {
    case "inWork": return A.board.inWork
    case "left": return A.board.left
    case "absent": return A.board.absent
    case "notYet": return A.board.notYet
    case "dayOff": return A.board.dayOff
    default: return A.status[state]
  }
}

type Employee = { id: string; name: string }

/** Qo'lda kiritish/tuzatish formasi (dialog ichida) */
function AttendanceFields({
  t, employees, userId, date, status, timeIn, timeOut, note, maxDate,
}: {
  t: Messages
  employees?: Employee[]
  userId?: string
  date: string
  status?: string
  timeIn?: string
  timeOut?: string
  note?: string | null
  maxDate: string
}) {
  const A = t.attendance
  return (
    <>
      {employees ? (
        <Field label={A.colEmployee}>
          <NativeSelect name="userId" required defaultValue="">
            <option value="" disabled>{t.workers.selectEmployee}</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </NativeSelect>
        </Field>
      ) : (
        <input type="hidden" name="userId" value={userId} />
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={A.date}>
          <Input name="date" type="date" required defaultValue={date} max={maxDate} className={inputClass} />
        </Field>
        <Field label={t.common.status}>
          <NativeSelect name="status" defaultValue={status ?? "PRESENT"}>
            {(["PRESENT", "SICK", "VACATION", "EXCUSED"] as const).map(s => <option key={s} value={s}>{A.status[s]}</option>)}
          </NativeSelect>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={A.timeIn}>
          <Input name="timeIn" type="time" defaultValue={timeIn} className={inputClass} />
        </Field>
        <Field label={A.timeOut}>
          <Input name="timeOut" type="time" defaultValue={timeOut} className={inputClass} />
        </Field>
      </div>
      <p className="text-xs text-gray-500">{A.timeHint}</p>
      <Field label={t.common.note}>
        <Input name="note" defaultValue={note ?? ""} placeholder={t.common.notePlaceholder} className={inputClass} />
      </Field>
    </>
  )
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const me = await getSessionUser()
  const params = await searchParams
  const [t, locale, board, timesheet, records, schedule] = await Promise.all([
    getT(), getLocale(), getTodayBoard(), getTimesheet(params), getAttendanceRecords(params), getWorkSchedule(),
  ])
  const A = t.attendance
  const { range } = timesheet
  const today = tashkentDateKey(new Date())
  // Menejer faqat ishchilarni tuzatadi
  const editable = (role: string) => me.role === "ADMIN" || role === "WORKER"
  const employees = board.rows.filter(r => editable(r.role)).map(r => ({ id: r.userId, name: r.name }))
  const time = (d: Date | null) => (d ? tashkentTimeKey(new Date(d)) : t.common.none)

  return (
    <div className={pageClass}>
      <PageHeader icon={<ClockIcon className="text-teal-600" />} title={A.title} subtitle={A.subtitle}>
        <FormDialog
          triggerClassName="h-10 px-4 gap-1.5 font-bold text-teal-700 border-teal-100 hover:bg-teal-50"
          trigger={<><PlusIcon className="w-4 h-4" />{A.manualEntry}</>}
          title={A.manualEntryTitle}
          action={saveAttendance}
          submitLabel={t.common.save}
          submitClassName="bg-teal-600 hover:bg-teal-700 text-white"
        >
          <AttendanceFields t={t} employees={employees} date={today} maxDate={today} />
        </FormDialog>
        <ExportButton kind="timesheet" from={range.from} to={range.to} label={`${A.timesheetTitle} · Excel`} />
        <ExportButton kind="attendance" from={range.from} to={range.to} label={`${A.recordsTitle} · Excel`} />
      </PageHeader>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 items-start">
        <div className="xl:col-span-3 space-y-8 min-w-0">
          {/* Bugun */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-xl font-black text-gray-900">{A.todayTitle} · {formatDate(new Date(), locale)}</h2>
              {schedule.geo
                ? <span className="text-xs font-bold text-sky-700">{A.geoOn(`${schedule.geo.radius} m`)}</span>
                : <span className="text-xs font-bold text-gray-400">{A.geoOff}</span>}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Count icon={<UsersIcon className="w-5 h-5" />} label={A.countInWork} value={`${board.counts.inWork} / ${board.counts.total}`} tone="text-green-700 bg-green-50" />
              <Count icon={<AlarmClockIcon className="w-5 h-5" />} label={A.countLate} value={String(board.counts.late)} tone="text-amber-700 bg-amber-50" />
              <Count icon={<UserXIcon className="w-5 h-5" />} label={A.countAbsent} value={String(board.counts.absent)} tone="text-rose-700 bg-rose-50" />
              <Count icon={<StethoscopeIcon className="w-5 h-5" />} label={A.countExcused} value={String(board.counts.excused)} tone="text-sky-700 bg-sky-50" />
            </div>

            <Card className="shadow-sm border-none bg-white overflow-hidden">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50">
                      <TableHead className="px-4 font-bold">{A.colEmployee}</TableHead>
                      <TableHead className="px-4 font-bold">{A.colStatus}</TableHead>
                      <TableHead className="px-4 font-bold">{A.colIn}</TableHead>
                      <TableHead className="px-4 font-bold">{A.colOut}</TableHead>
                      <TableHead className="px-4 font-bold">{A.colWorked}</TableHead>
                      <TableHead className="px-4 font-bold">{A.colLate}</TableHead>
                      {schedule.geo && <TableHead className="px-4 font-bold">{A.colDistance}</TableHead>}
                      <TableHead className="px-4" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {board.rows.map(row => (
                      <TableRow key={row.userId}>
                        <TableCell className="px-4">
                          <div className="font-bold text-gray-900">{row.name}</div>
                          <div className="text-[11px] text-gray-400">{t.common.roles[row.role]}</div>
                        </TableCell>
                        <TableCell className="px-4">
                          <Badge variant="outline" className={STATE_CLASS[row.state]}>{stateLabel(t, row.state)}</Badge>
                          {row.source && row.source !== "SELF" && <div className="text-[10px] text-gray-400 mt-0.5">{row.source === "DEVICE" ? A.sourceDevice : A.sourceManager}</div>}
                        </TableCell>
                        <TableCell className="px-4 font-mono text-sm">{time(row.checkIn)}</TableCell>
                        <TableCell className="px-4 font-mono text-sm">{time(row.checkOut)}</TableCell>
                        <TableCell className="px-4 font-mono text-sm">{row.checkIn ? formatDuration(row.workedMinutes) : t.common.none}</TableCell>
                        <TableCell className="px-4 text-sm">
                          {row.lateMinutes > 0 ? <span className="font-bold text-rose-600">{A.minutes(row.lateMinutes)}</span> : t.common.none}
                        </TableCell>
                        {schedule.geo && (
                          <TableCell className="px-4 text-xs text-gray-500">{row.distance !== null ? `${formatNumber(row.distance, locale, 0)} m` : t.common.none}</TableCell>
                        )}
                        <TableCell className="px-4 text-right">
                          {editable(row.role) && (
                            <FormDialog
                              triggerClassName="gap-1"
                              trigger={<><PencilIcon className="w-3.5 h-3.5" />{A.edit}</>}
                              title={`${A.edit}: ${row.name}`}
                              action={saveAttendance}
                              submitLabel={t.common.save}
                            >
                              <AttendanceFields
                                t={t}
                                userId={row.userId}
                                date={board.date}
                                maxDate={today}
                                status={row.status ?? "PRESENT"}
                                timeIn={row.checkIn ? tashkentTimeKey(new Date(row.checkIn)) : undefined}
                                timeOut={row.checkOut ? tashkentTimeKey(new Date(row.checkOut)) : undefined}
                                note={row.note}
                              />
                            </FormDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {board.rows.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="h-24 text-center text-gray-400 italic">{A.noStaff}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>

          {/* Tabel */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-gray-900">{A.timesheetTitle}</h2>
            <DateRangeFilter basePath="/attendance" from={range.from} to={range.to} allowAllTime={false} />
            <p className="text-xs text-gray-500 px-1 -mt-2">{A.timesheetHint}</p>
            <Card className="shadow-sm border-none bg-white overflow-hidden">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50">
                      <TableHead className="px-3 font-bold">{A.colEmployee}</TableHead>
                      <TableHead className="px-3 font-bold text-right">{A.colWorkingDays}</TableHead>
                      <TableHead className="px-3 font-bold text-right">{A.colPresent}</TableHead>
                      <TableHead className="px-3 font-bold text-right">{A.colAbsent}</TableHead>
                      <TableHead className="px-3 font-bold">{A.colLateCount}</TableHead>
                      <TableHead className="px-3 font-bold">{A.colEarly}</TableHead>
                      <TableHead className="px-3 font-bold text-right">{A.colHours}</TableHead>
                      <TableHead className="px-3 font-bold text-right">{A.colOvertime}</TableHead>
                      <TableHead className="px-3 font-bold text-right">{A.colLeave}</TableHead>
                      <TableHead className="px-3 font-bold text-right">{A.colMissing}</TableHead>
                      <TableHead className="px-3 font-bold text-right">{A.colPieces}</TableHead>
                      <TableHead className="px-3 font-bold text-right">{A.colPerHour}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timesheet.rows.map(row => {
                      const s = row.summary
                      return (
                        <TableRow key={row.userId} className={row.isActive ? "" : "opacity-60"}>
                          <TableCell className="px-3">
                            <div className="font-bold text-gray-900">{row.name}</div>
                            <div className="text-[11px] text-gray-400">{t.common.roles[row.role]}{row.isActive ? "" : ` · ${t.common.blocked}`}</div>
                          </TableCell>
                          <TableCell className="px-3 text-right">{s.workingDays}</TableCell>
                          <TableCell className="px-3 text-right font-bold text-green-700">{s.presentDays}</TableCell>
                          <TableCell className={`px-3 text-right font-bold ${s.absentDays > 0 ? "text-rose-600" : "text-gray-400"}`}>{s.absentDays}</TableCell>
                          <TableCell className="px-3 text-xs whitespace-nowrap">{s.lateCount > 0 ? <span className="text-amber-700 font-bold">{A.timesCount(s.lateCount, s.lateMinutes)}</span> : t.common.none}</TableCell>
                          <TableCell className="px-3 text-xs whitespace-nowrap">{s.earlyLeaveCount > 0 ? A.timesCount(s.earlyLeaveCount, s.earlyLeaveMinutes) : t.common.none}</TableCell>
                          <TableCell className="px-3 text-right font-mono font-bold">{formatDuration(s.workedMinutes)}</TableCell>
                          <TableCell className="px-3 text-right font-mono text-gray-500">{formatDuration(s.overtimeMinutes)}</TableCell>
                          <TableCell className="px-3 text-right">{s.sickDays + s.vacationDays + s.excusedDays}</TableCell>
                          <TableCell className={`px-3 text-right ${s.missingCheckouts > 0 ? "text-amber-700 font-bold" : "text-gray-400"}`}>{s.missingCheckouts}</TableCell>
                          <TableCell className="px-3 text-right">{formatNumber(row.pieces, locale)}</TableCell>
                          <TableCell className="px-3 text-right text-gray-600">{row.piecesPerHour !== null ? formatNumber(row.piecesPerHour, locale, 1) : t.common.none}</TableCell>
                        </TableRow>
                      )
                    })}
                    {timesheet.rows.length === 0 && (
                      <TableRow><TableCell colSpan={12} className="h-24 text-center text-gray-400 italic">{A.noStaff}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>

          {/* Yozuvlar */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-gray-900">{A.recordsTitle}</h2>
            <Card className="shadow-sm border-none bg-white overflow-hidden">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50">
                      <TableHead className="px-4 font-bold">{A.date}</TableHead>
                      <TableHead className="px-4 font-bold">{A.colEmployee}</TableHead>
                      <TableHead className="px-4 font-bold">{A.colStatus}</TableHead>
                      <TableHead className="px-4 font-bold">{A.colIn}</TableHead>
                      <TableHead className="px-4 font-bold">{A.colOut}</TableHead>
                      <TableHead className="px-4 font-bold">{A.colWorked}</TableHead>
                      <TableHead className="px-4 font-bold">{A.colSource}</TableHead>
                      <TableHead className="px-4" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="px-4 text-sm whitespace-nowrap">{formatDate(`${r.date}T12:00:00+05:00`, locale)}</TableCell>
                        <TableCell className="px-4 font-bold text-gray-900">{r.userName}</TableCell>
                        <TableCell className="px-4">
                          <Badge variant="outline">{A.status[r.status]}</Badge>
                          {r.lateMinutes > 0 && <span className="ml-1 text-[11px] font-bold text-rose-600">{A.minutes(r.lateMinutes)}</span>}
                          {r.missingCheckout && <div className="text-[11px] font-bold text-amber-700">{A.board.missingCheckout}</div>}
                        </TableCell>
                        <TableCell className="px-4 font-mono text-sm">{time(r.checkIn)}</TableCell>
                        <TableCell className="px-4 font-mono text-sm">{time(r.checkOut)}</TableCell>
                        <TableCell className="px-4 font-mono text-sm">{r.checkIn ? formatDuration(r.workedMinutes) : t.common.none}</TableCell>
                        <TableCell className="px-4 text-xs text-gray-500">
                          {r.source === "SELF" ? A.sourceSelf : r.source === "DEVICE" ? A.sourceDevice : `${A.sourceManager}${r.editedByName ? `: ${r.editedByName}` : ""}`}
                          {r.note && <div className="text-gray-400 max-w-48 truncate">{r.note}</div>}
                        </TableCell>
                        <TableCell className="px-4">
                          {editable(r.userRole) && (
                            <div className="flex justify-end gap-1">
                              <FormDialog
                                triggerClassName="gap-1"
                                trigger={<PencilIcon className="w-3.5 h-3.5" />}
                                title={`${A.edit}: ${r.userName}`}
                                action={saveAttendance}
                                submitLabel={t.common.save}
                              >
                                <AttendanceFields
                                  t={t}
                                  userId={r.userId}
                                  date={r.date}
                                  maxDate={today}
                                  status={r.status}
                                  timeIn={r.checkIn ? tashkentTimeKey(new Date(r.checkIn)) : undefined}
                                  timeOut={r.checkOut ? tashkentTimeKey(new Date(r.checkOut)) : undefined}
                                  note={r.note}
                                />
                              </FormDialog>
                              <DeleteButton action={deleteAttendance.bind(null, r.id)} confirmText={A.confirmDelete} />
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {records.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="h-24 text-center text-gray-400 italic">{A.noRecords}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>
        </div>

        {me.role === "ADMIN" && (
          <Card className="shadow-sm border-none bg-white xl:sticky xl:top-28">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2Icon className="w-5 h-5 text-indigo-600" /> {A.settingsTitle}
              </CardTitle>
              <CardDescription>{A.schedule(schedule.workStartTime, schedule.workEndTime)}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScheduleForm schedule={schedule} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function Count({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest truncate">{label}</p>
        <p className="text-2xl font-black text-gray-900">{value}</p>
      </div>
      <div className={`p-2.5 rounded-xl shrink-0 ${tone}`}>{icon}</div>
    </div>
  )
}
