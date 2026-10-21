'use client'

import { useState } from "react"
import { updateWorkSchedule } from "@/lib/actions/attendance"
import { ActionForm } from "@/components/ui/action-form"
import { Field, inputClass } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/client"
import { getCurrentCoords } from "@/lib/geo-client"
import { LocateFixedIcon } from "lucide-react"

export function ScheduleForm({
  schedule,
}: {
  schedule: {
    workStartTime: string
    workEndTime: string
    lateGraceMinutes: number
    workDays: number[]
    geo: { lat: number; lng: number; radius: number } | null
  }
}) {
  const t = useT()
  const A = t.attendance
  const [lat, setLat] = useState(schedule.geo ? String(schedule.geo.lat) : "")
  const [lng, setLng] = useState(schedule.geo ? String(schedule.geo.lng) : "")
  const [radius, setRadius] = useState(schedule.geo ? String(schedule.geo.radius) : "")
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  async function useMyLocation() {
    setGeoError(null)
    setLocating(true)
    try {
      const coords = await getCurrentCoords()
      setLat(coords.lat.toFixed(6))
      setLng(coords.lng.toFixed(6))
      if (!radius) setRadius("150")
    } catch {
      setGeoError(A.locationDenied)
    } finally {
      setLocating(false)
    }
  }

  return (
    <ActionForm action={updateWorkSchedule} successMessage={A.settingsSaved} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={A.workStart}>
          <Input key={schedule.workStartTime} name="workStartTime" type="time" required defaultValue={schedule.workStartTime} className={inputClass} />
        </Field>
        <Field label={A.workEnd}>
          <Input key={schedule.workEndTime} name="workEndTime" type="time" required defaultValue={schedule.workEndTime} className={inputClass} />
        </Field>
      </div>
      <Field label={A.grace}>
        <Input key={schedule.lateGraceMinutes} name="lateGraceMinutes" type="number" min="0" max="240" step="1" required defaultValue={schedule.lateGraceMinutes} className={inputClass} />
      </Field>
      <Field label={A.workDays}>
        <div className="flex flex-wrap gap-1.5">
          {A.weekdays.map((label, index) => (
            <label key={label} className="cursor-pointer">
              <input key={`${index}-${schedule.workDays.includes(index + 1)}`} type="checkbox" name="workDays" value={index + 1} defaultChecked={schedule.workDays.includes(index + 1)} className="peer sr-only" />
              <span className="inline-flex items-center justify-center w-11 h-9 rounded-lg border border-gray-200 text-xs font-bold text-gray-500 peer-checked:bg-indigo-600 peer-checked:text-white peer-checked:border-indigo-600 peer-focus-visible:ring-3 peer-focus-visible:ring-indigo-500/30">
                {label}
              </span>
            </label>
          ))}
        </div>
      </Field>

      <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3 space-y-3">
        <p className="text-sm font-bold text-gray-700">{A.geoTitle}</p>
        <p className="text-xs text-gray-500">{A.geoHint}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label={A.geoLat}>
            <Input name="geoLat" inputMode="decimal" value={lat} onChange={e => setLat(e.target.value)} className={`${inputClass} bg-white`} />
          </Field>
          <Field label={A.geoLng}>
            <Input name="geoLng" inputMode="decimal" value={lng} onChange={e => setLng(e.target.value)} className={`${inputClass} bg-white`} />
          </Field>
        </div>
        <Field label={A.geoRadius}>
          <Input name="geoRadiusM" type="number" min="20" step="10" value={radius} onChange={e => setRadius(e.target.value)} className={`${inputClass} bg-white`} placeholder="150" />
        </Field>
        <Button type="button" variant="outline" onClick={useMyLocation} disabled={locating} className="w-full h-10 gap-1.5 bg-white">
          <LocateFixedIcon className="w-4 h-4" /> {locating ? A.gettingLocation : A.useMyLocation}
        </Button>
        {geoError && <p role="alert" className="text-xs text-rose-600">{geoError}</p>}
      </div>

      <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold h-11">{t.common.save}</Button>
    </ActionForm>
  )
}
