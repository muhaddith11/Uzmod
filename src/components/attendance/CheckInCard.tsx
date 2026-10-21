'use client'

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { checkIn, checkOut, getMyAttendanceToday } from "@/lib/actions/attendance"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/client"
import { tashkentTimeKey } from "@/lib/tz"
import { formatDuration } from "@/lib/domain/attendance"
import { getCurrentCoords } from "@/lib/geo-client"
import { AlertTriangleIcon, CheckCircle2Icon, Clock3Icon, LogInIcon, LogOutIcon, MapPinIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type MyToday = Awaited<ReturnType<typeof getMyAttendanceToday>>

/**
 * Xodimning "Ishga keldim / Ishdan ketdim" kartochkasi. Saytda server boshlang'ich
 * holatni beradi; Mini App'da `initial` yo'q — kartochka o'zi yuklaydi.
 */
export function CheckInCard({ initial, className }: { initial?: MyToday; className?: string }) {
  const t = useT()
  const A = t.attendance
  const router = useRouter()
  const [today, setToday] = useState<MyToday | null>(initial ?? null)
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(null)
  const [locating, setLocating] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [extraMinutes, setExtraMinutes] = useState(0)

  const reload = useCallback(async () => {
    const fresh = await getMyAttendanceToday()
    setToday(fresh)
    setExtraMinutes(0)
  }, [])

  // Mini App'da boshlang'ich holat serverdan kelmaydi — o'zimiz yuklaymiz
  useEffect(() => {
    if (initial) return
    let cancelled = false
    getMyAttendanceToday()
      .then(fresh => { if (!cancelled) setToday(fresh) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [initial])

  // Ishdaligida ishlagan vaqt har daqiqada oshib boradi
  const inProgress = today?.evaluation?.inProgress ?? false
  useEffect(() => {
    if (!inProgress) return
    const timer = setInterval(() => setExtraMinutes(m => m + 1), 60_000)
    return () => clearInterval(timer)
  }, [inProgress])

  if (!today) {
    return <div className={cn("bg-white rounded-2xl shadow-sm p-5 h-40 animate-pulse", className)} />
  }

  const record = today.record
  const status = record?.status ?? null
  const hasIn = Boolean(record?.checkIn)
  const hasOut = Boolean(record?.checkOut)
  const worked = (today.evaluation?.workedMinutes ?? 0) + (inProgress ? extraMinutes : 0)
  const late = today.evaluation?.lateMinutes ?? 0

  function submit(kind: "in" | "out") {
    setMessage(null)
    startTransition(async () => {
      const formData = new FormData()
      if (today?.requireLocation) {
        setLocating(true)
        try {
          const coords = await getCurrentCoords()
          formData.set("lat", String(coords.lat))
          formData.set("lng", String(coords.lng))
          formData.set("accuracy", String(Math.round(coords.accuracy)))
        } catch {
          setMessage({ type: "error", text: A.locationDenied })
          return
        } finally {
          setLocating(false)
        }
      }
      const result = await (kind === "in" ? checkIn(formData) : checkOut(formData))
      if (result.error) {
        setMessage({ type: "error", text: result.error })
        return
      }
      setMessage({ type: "ok", text: kind === "in" ? A.savedIn : A.savedOut })
      await reload()
      router.refresh()
    })
  }

  return (
    <div className={cn("bg-white rounded-2xl shadow-sm p-5 space-y-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <Clock3Icon className="w-4 h-4" /> {A.myToday}
          </p>
          <p className="text-sm text-gray-500 mt-1">{A.schedule(today.workStartTime, today.workEndTime)}</p>
        </div>
        {today.requireLocation && (
          <span className="text-[11px] font-bold text-sky-700 bg-sky-50 rounded-full px-2 py-1 flex items-center gap-1 shrink-0">
            <MapPinIcon className="w-3 h-3" /> {today.radius} m
          </span>
        )}
      </div>

      <div className="space-y-1">
        {status && status !== "PRESENT" ? (
          <p className="text-lg font-black text-amber-700">{A.status[status]}</p>
        ) : !hasIn ? (
          <p className="text-lg font-bold text-gray-700">{today.isWorkday ? A.notCheckedIn : A.board.dayOff}</p>
        ) : (
          <>
            <p className="text-lg font-black text-gray-900 flex flex-wrap items-center gap-2">
              {A.checkedInAt(tashkentTimeKey(new Date(record!.checkIn!)))}
              {late > 0 && (
                <span className="text-xs font-bold text-rose-700 bg-rose-50 rounded-full px-2 py-0.5">
                  {A.board.late}: {A.minutes(late)}
                </span>
              )}
            </p>
            {hasOut && <p className="text-sm font-semibold text-gray-600">{A.checkedOutAt(tashkentTimeKey(new Date(record!.checkOut!)))}</p>}
            <p className="text-sm text-gray-500">{A.workedToday(formatDuration(worked))}</p>
          </>
        )}
      </div>

      {(!status || status === "PRESENT") && (
        hasOut ? (
          <div className="rounded-xl bg-green-50 text-green-700 text-sm font-bold p-3 flex items-center gap-2">
            <CheckCircle2Icon className="w-4 h-4" /> {A.dayDone}
          </div>
        ) : (
          <Button
            type="button"
            disabled={isPending}
            onClick={() => submit(hasIn ? "out" : "in")}
            className={cn(
              "w-full h-12 text-base font-bold text-white gap-2",
              hasIn ? "bg-rose-600 hover:bg-rose-700" : "bg-green-600 hover:bg-green-700"
            )}
          >
            {hasIn ? <LogOutIcon className="w-5 h-5" /> : <LogInIcon className="w-5 h-5" />}
            {locating ? A.gettingLocation : hasIn ? A.checkOut : A.checkIn}
          </Button>
        )
      )}

      {today.requireLocation && !hasOut && <p className="text-[11px] text-gray-400">{A.locationRequired}</p>}

      {message && (
        <div
          role={message.type === "error" ? "alert" : "status"}
          className={cn(
            "rounded-xl p-3 text-sm font-medium flex items-start gap-2",
            message.type === "error" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-green-50 text-green-700 border border-green-200"
          )}
        >
          {message.type === "error" ? <AlertTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" /> : <CheckCircle2Icon className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  )
}
