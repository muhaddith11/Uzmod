'use client'

import { useMemo, useState } from "react"
import { addYarnToRun, closeRun, recordCount, setMachineActive } from "@/lib/actions/machines"
import type { getMachinesBoard } from "@/lib/actions/machines"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ActionForm } from "@/components/ui/action-form"
import { ActionButton } from "@/components/ui/action-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, NativeSelect, inputClass } from "@/components/ui/field"
import { StartRunsForm, type MachineFormOptions } from "@/components/machines/StartRunsForm"
import { useLocale, useT } from "@/i18n/client"
import { formatNumber } from "@/lib/format"
import { colorHex, pairsFromKg } from "@/lib/domain/machines"
import { tashkentDateKey, tashkentTimeKey } from "@/lib/tz"
import { cn } from "@/lib/utils"

type BoardMachine = Awaited<ReturnType<typeof getMachinesBoard>>[number]
type Panel = "count" | "yarn" | "finish"

export function MachineBoard({
  machines,
  options,
  canManage,
}: {
  machines: BoardMachine[]
  options: MachineFormOptions
  canManage: boolean
}) {
  const t = useT()
  const M = t.machines
  const groups = useMemo(() => [...new Set(machines.map(m => m.group))].sort(), [machines])
  const [group, setGroup] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const visible = group ? machines.filter(m => m.group === group) : machines
  const selected = machines.find(m => m.id === selectedId) ?? null
  const running = machines.filter(m => m.run).length

  const chip = (active: boolean) =>
    cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-colors", active ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={chip(group === null)} onClick={() => setGroup(null)}>{M.allGroups}</button>
          {groups.map(g => (
            <button key={g} type="button" className={chip(group === g)} onClick={() => setGroup(g)}>
              {M.group}: {g} ({machines.filter(m => m.group === g).length})
            </button>
          ))}
        </div>
        <span className="text-sm font-bold text-green-700">{M.summaryRunning(running, machines.length)}</span>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
        {visible.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelectedId(m.id)}
            title={m.run ? `${m.run.yarnName} · ${m.run.productName} · ${m.run.gramsPerSock} g` : M.idle}
            className={cn(
              "relative rounded-xl border text-left p-2 h-[4.5rem] overflow-hidden transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-indigo-500/40 outline-none",
              !m.isActive ? "bg-gray-100 border-gray-200 opacity-50" : m.run ? "bg-white border-green-200" : "bg-white border-dashed border-gray-300"
            )}
          >
            {m.run && <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: colorHex(m.run.yarnColor) }} />}
            <span className="block text-lg font-black text-gray-900 leading-tight">{m.number}</span>
            {m.run ? (
              <span className="block text-[10px] font-bold text-green-700 leading-tight truncate">{m.run.gramsPerSock} g · {m.run.countedPairs}</span>
            ) : (
              <span className="block text-[10px] text-gray-400 leading-tight">{m.isActive ? M.idle : M.off}</span>
            )}
          </button>
        ))}
      </div>

      <Dialog open={selected !== null} onOpenChange={open => !open && setSelectedId(null)}>
        <DialogContent className="bg-white sm:max-w-md max-h-[90vh] overflow-y-auto">
          {selected && (
            <MachineDetails
              key={selected.id + (selected.run?.id ?? "")}
              machine={selected}
              options={options}
              canManage={canManage}
              onDone={() => setSelectedId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MachineDetails({
  machine,
  options,
  canManage,
  onDone,
}: {
  machine: BoardMachine
  options: MachineFormOptions
  canManage: boolean
  onDone: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const M = t.machines
  const [panel, setPanel] = useState<Panel>("count")
  const run = machine.run
  const fmt = (n: number) => formatNumber(n, locale)

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-lg font-black text-gray-900 pr-6">
          {M.machine(machine.number)} · {M.group} {machine.group}
        </DialogTitle>
      </DialogHeader>

      {!run ? (
        machine.isActive ? (
          <div className="space-y-4">
            <StartRunsForm options={options} machineNumbers={String(machine.number)} lockNumbers onSuccess={onDone} />
            {canManage && (
              <ActionButton action={setMachineActive.bind(null, machine.id, false)} variant="ghost" className="w-full text-gray-500">
                {M.setInactive}
              </ActionButton>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{M.off}</p>
            {canManage && (
              <ActionButton action={setMachineActive.bind(null, machine.id, true)} className="w-full">{M.setActive}</ActionButton>
            )}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Info label={M.yarn} value={
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border border-gray-300" style={{ background: colorHex(run.yarnColor) }} />
                {run.yarnName}
              </span>
            } />
            <Info label={M.model} value={run.productName} />
            <Info label={M.gramsPerSock} value={`${run.gramsPerSock} g · ${M.perKg(fmt(pairsFromKg(1, run.gramsPerSock)))}`} />
            <Info label={M.issued} value={`${fmt(run.issuedKg)} kg`} />
            <Info label={M.counted} value={t.yarn.pairs(fmt(run.countedPairs))} strong />
            <Info label={M.expected} value={t.yarn.pairs(fmt(run.expectedPairs))} />
            <Info label={M.efficiency} value={run.efficiencyPercent !== null ? `${run.efficiencyPercent}%` : t.common.none} />
            <Info
              label={M.since}
              value={`${tashkentDateKey(new Date(run.startedAt)).slice(5).split("-").reverse().join(".")} ${tashkentTimeKey(new Date(run.startedAt))}${run.lastWorker ? ` · ${run.lastWorker}` : ""}`}
            />
          </div>

          <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1" role="tablist">
            {(["count", "yarn", "finish"] as const).map(p => (
              <button
                key={p} type="button" role="tab" aria-selected={panel === p} onClick={() => setPanel(p)}
                className={cn("h-9 rounded-lg text-xs font-bold", panel === p ? "bg-white shadow-sm text-gray-900" : "text-gray-500")}
              >
                {p === "count" ? M.count : p === "yarn" ? M.addYarn : M.finish}
              </button>
            ))}
          </div>

          {panel === "count" && (
            <ActionForm action={recordCount} onSuccess={onDone} className="space-y-3">
              <input type="hidden" name="runId" value={run.id} />
              <Field label={M.countPairs}>
                <Input name="pairs" type="number" min="1" step="1" required inputMode="numeric" className={`${inputClass} text-lg`} />
              </Field>
              <WorkerSelect options={options} />
              <Button type="submit" className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold">{M.count}</Button>
            </ActionForm>
          )}
          {panel === "yarn" && (
            <ActionForm action={addYarnToRun} onSuccess={onDone} className="space-y-3">
              <input type="hidden" name="runId" value={run.id} />
              <Field label={t.yarn.kg}>
                <Input name="kg" type="number" min="0" step="0.01" required inputMode="decimal" className={`${inputClass} text-lg`} />
              </Field>
              <WorkerSelect options={options} />
              <Button type="submit" className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-bold">{M.addYarn}</Button>
            </ActionForm>
          )}
          {panel === "finish" && (
            <ActionForm action={closeRun} onSuccess={onDone} className="space-y-3">
              <input type="hidden" name="runId" value={run.id} />
              <p className="text-xs text-gray-500">{M.finishHint}</p>
              <Field label={M.leftoverKg}>
                <Input name="leftoverKg" type="number" min="0" step="0.01" required inputMode="decimal" defaultValue="0" className={inputClass} />
              </Field>
              <Field label={M.finalCount}>
                <Input name="finalPairs" type="number" min="0" step="1" inputMode="numeric" className={inputClass} />
              </Field>
              <WorkerSelect options={options} />
              <Button type="submit" className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white font-bold">{M.finish}</Button>
            </ActionForm>
          )}
        </div>
      )}
    </>
  )
}

function WorkerSelect({ options }: { options: MachineFormOptions }) {
  const t = useT()
  if (!options.canChooseWorker) return null
  return (
    <Field label={t.common.worker}>
      <NativeSelect name="workerId" defaultValue="">
        <option value="">{t.common.none}</option>
        {options.workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
      </NativeSelect>
    </Field>
  )
}

function Info({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2 min-w-0">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={cn("text-sm truncate", strong ? "font-black text-gray-900" : "font-semibold text-gray-700")}>{value}</p>
    </div>
  )
}
