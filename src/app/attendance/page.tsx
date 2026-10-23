import { getTodayBoard, getWorkSchedule, saveAttendance, type BoardState } from "@/lib/actions/attendance"
import { getSessionUser } from "@/lib/session"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { FormDialog } from "@/components/ui/form-dialog"
import { Field, NativeSelect, inputClass } from "@/components/ui/field"
import { ScheduleForm } from "@/components/attendance/ScheduleForm"
import { PageHeader, pageClass } from "@/components/PageHeader"
import { ExportButton } from "@/components/ExportButton"
import { getLocale, getT } from "@/i18n/server"
import type { Messages } from "@/i18n/messages"
import { formatDate } from "@/lib/format"
import { formatDuration } from "@/lib/domain/attendance"
import { boardStateLabel } from "@/lib/attendance"
import { tashkentDateKey, tashkentTimeKey } from "@/lib/tz"
import { ClockIcon, PencilIcon, PlusIcon, Settings2Icon, UsersIcon, AlarmClockIcon, UserXIcon, StethoscopeIcon } from "lucide-react"

const STATE_CLASS: Record<BoardState, string> = {
  inWork: "bg-green-50 text-green-700 border-green-100",
  left: "bg-gray-100 text-gray-600 border-gray-200",
  absent: "bg-rose-50 text-rose-700 border-rose-100",
  notYet: "bg-amber-50 text-amber-700 border-amber-100",
  dayOff: "bg-gray-50 text-gray-500 border-gray-100",
  SICK: "bg-sky-50 text-sky-700 border-sky-100",
  VACATION: "bg-sky-50 text-sky-700 border-sky-100",
  EXCUSED: "bg-sky-50 text-sky-700 border-sky-100",
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

export default async function AttendancePage() {
  const me = await getSessionUser()
  const [t, locale, board, schedule] = await Promise.all([getT(), getLocale(), getTodayBoard(), getWorkSchedule()])
  const A = t.attendance
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
        <ExportButton kind="attendance" />
      </PageHeader>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 items-start">
        <section className="xl:col-span-3 space-y-4 min-w-0">
          <h2 className="text-xl font-black text-gray-900">{A.todayTitle} · {formatDate(new Date(), locale)}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Count icon={<UsersIcon className="w-5 h-5" />} label={A.countInWork} value={`${board.counts.inWork} / ${board.counts.total}`} tone="text-green-700 bg-green-50" />
            <Count icon={<AlarmClockIcon className="w-5 h-5" />} label={A.countLate} value={String(board.counts.late)} tone="text-amber-700 bg-amber-50" />
            <Count icon={<UserXIcon className="w-5 h-5" />} label={A.countAbsent} value={String(board.counts.absent)} tone="text-rose-700 bg-rose-50" />
            <Count icon={<StethoscopeIcon className="w-5 h-5" />} label={A.countExcused} value={String(board.counts.excused)} tone="text-sky-700 bg-sky-50" />
          </div>

          <Card className="overflow-hidden py-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead className="px-5">{A.colEmployee}</TableHead>
                    <TableHead className="px-4">{A.colStatus}</TableHead>
                    <TableHead className="px-4">{A.colIn}</TableHead>
                    <TableHead className="px-4">{A.colOut}</TableHead>
                    <TableHead className="px-4">{A.colWorked}</TableHead>
                    <TableHead className="px-4">{A.colLate}</TableHead>
                    <TableHead className="px-5" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {board.rows.map(row => (
                    <TableRow key={row.userId}>
                      <TableCell className="px-5">
                        <div className="font-bold text-gray-900">{row.name}</div>
                        {row.role !== "WORKER" && <div className="text-[11px] text-gray-500">{t.common.roles[row.role]}</div>}
                      </TableCell>
                      <TableCell className="px-4">
                        <Badge variant="outline" className={STATE_CLASS[row.state]}>{boardStateLabel(t, row.state)}</Badge>
                        {row.source && row.source !== "SELF" && <div className="text-[10px] text-gray-500 mt-0.5">{row.source === "DEVICE" ? A.sourceDevice : A.sourceManager}</div>}
                      </TableCell>
                      <TableCell className="px-4 font-mono text-sm">{time(row.checkIn)}</TableCell>
                      <TableCell className="px-4 font-mono text-sm">{time(row.checkOut)}</TableCell>
                      <TableCell className="px-4 font-mono text-sm">{row.checkIn ? formatDuration(row.workedMinutes) : t.common.none}</TableCell>
                      <TableCell className="px-4 text-sm">
                        {row.lateMinutes > 0 ? <span className="font-bold text-rose-600">{A.minutes(row.lateMinutes)}</span> : t.common.none}
                      </TableCell>
                      <TableCell className="px-5 text-right">
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
                    <TableRow><TableCell colSpan={7} className="h-24 text-center text-gray-500">{A.noStaff}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {me.role === "ADMIN" && (
          <Card className="xl:sticky xl:top-24">
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
    <div className="bg-white rounded-2xl ring-1 ring-gray-200/80 p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-500 truncate">{label}</p>
        <p className="text-2xl font-black text-gray-900">{value}</p>
      </div>
      <div className={`p-2.5 rounded-xl shrink-0 ${tone}`}>{icon}</div>
    </div>
  )
}
