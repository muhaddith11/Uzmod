'use client'

import { updateWorkSchedule } from "@/lib/actions/attendance"
import { ActionForm } from "@/components/ui/action-form"
import { Field, inputClass } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/client"

export function ScheduleForm({
  schedule,
}: {
  schedule: {
    workStartTime: string
    workEndTime: string
    lateGraceMinutes: number
    workDays: number[]
  }
}) {
  const t = useT()
  const A = t.attendance

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

      <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold h-11">{t.common.save}</Button>
    </ActionForm>
  )
}
