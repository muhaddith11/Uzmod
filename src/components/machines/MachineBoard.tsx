'use client'

import { useEffect, useMemo, useState } from "react"
import { cancelLoad, finishLoadNow, setMachineActive } from "@/lib/actions/machines"
import type { getMachinesBoard } from "@/lib/actions/machines"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ActionButton } from "@/components/ui/action-button"
import { LoadMachinesForm, type LoadFormOptions } from "@/components/machines/LoadMachinesForm"
import { useLocale, useT } from "@/i18n/client"
import { formatDayTime, formatNumber } from "@/lib/format"
import { colorHex, socksFromKg } from "@/lib/domain/machines"
import { cn } from "@/lib/utils"

type Board = Awaited<ReturnType<typeof getMachinesBoard>>
type BoardMachine = Board["machines"][number]
type BoardLoad = BoardMachine["loads"][number]

/** Joriy vaqt faqat brauzerda (server va client vaqti farqi sahifani buzmasin), har daqiqada */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, intervalMs)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [intervalMs])
  return now
}

function progressOf(load: BoardLoad, now: number) {
  const start = new Date(load.loadedAt).getTime()
  const end = new Date(load.readyAt).getTime()
  return Math.min(Math.max((now - start) / Math.max(end - start, 1), 0), 1)
}

export function MachineBoard({
  board,
  options,
  canManage,
}: {
  board: Board
  options: LoadFormOptions
  canManage: boolean
}) {
  const t = useT()
  const locale = useLocale()
  const M = t.machines
  const now = useNow()
  const { machines } = board
  const groups = useMemo(() => [...new Set(machines.map(m => m.group))].sort(), [machines])
  const [group, setGroup] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const visible = group ? machines.filter(m => m.group === group) : machines
  const selected = machines.find(m => m.id === selectedId) ?? null
  const running = machines.filter(m => m.loads.length > 0).length

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
        {visible.map(m => {
          const first = m.loads[0]
          const kg = m.loads.reduce((acc, l) => acc + l.kg, 0)
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedId(m.id)}
              title={first ? `${first.yarnName} · ${first.gramsPerSock} g` : M.idle}
              aria-label={`${M.machine(m.number)}: ${first ? `${M.knitting}, ${first.yarnName}, ${first.gramsPerSock} g` : m.isActive ? M.idle : M.off}`}
              className={cn(
                "relative rounded-xl border text-left p-2 h-[4.5rem] overflow-hidden transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-indigo-500/40 outline-none",
                !m.isActive ? "bg-gray-100 border-gray-200 opacity-50" : first ? "bg-white border-green-200" : "bg-white border-dashed border-gray-300"
              )}
            >
              {first && <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: colorHex(first.yarnColor) }} />}
              <span className="block text-lg font-black text-gray-900 leading-tight">{m.number}</span>
              {first ? (
                <span className="block text-[10px] font-bold text-green-700 leading-tight truncate">{first.gramsPerSock} g · {formatNumber(kg, locale)} kg</span>
              ) : (
                <span className="block text-[10px] text-gray-400 leading-tight">{m.isActive ? M.idle : M.off}</span>
              )}
              {first && now !== null && (
                <span className="absolute inset-x-2 bottom-1.5 h-1 rounded-full bg-gray-100 overflow-hidden">
                  <span className="block h-full bg-green-500" style={{ width: `${Math.round(progressOf(first, now) * 100)}%` }} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <Dialog open={selected !== null} onOpenChange={open => !open && setSelectedId(null)}>
        <DialogContent className="bg-white sm:max-w-md max-h-[90vh] overflow-y-auto">
          {selected && (
            <MachineDetails
              key={selected.id + selected.loads.map(l => l.id).join()}
              machine={selected}
              options={options}
              canManage={canManage}
              now={now}
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
  now,
  onDone,
}: {
  machine: BoardMachine
  options: LoadFormOptions
  canManage: boolean
  now: number | null
  onDone: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const M = t.machines
  const [adding, setAdding] = useState(machine.loads.length === 0)
  const fmt = (n: number) => formatNumber(n, locale)

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-lg font-black text-gray-900 pr-6">
          {M.machine(machine.number)} · {M.group} {machine.group}
        </DialogTitle>
      </DialogHeader>

      {!machine.isActive ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{M.off}</p>
          {canManage && (
            <ActionButton action={setMachineActive.bind(null, machine.id, true)} className="w-full">{M.setActive}</ActionButton>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {machine.loads.map(load => {
            const leftMs = now === null ? null : new Date(load.readyAt).getTime() - now
            const leftMin = leftMs === null ? 0 : Math.max(Math.floor(leftMs / 60_000), 0)
            return (
              <div key={load.id} className="rounded-xl border border-green-100 bg-green-50/40 p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Info label={M.yarn} value={
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full border border-gray-300" style={{ background: colorHex(load.yarnColor) }} />
                      {load.yarnName}
                    </span>
                  } />
                  <Info label={M.gramsPerSock} value={`${load.gramsPerSock} g · ${M.perKg(fmt(socksFromKg(1, load.gramsPerSock)))}`} />
                  <Info label={t.yarn.kg} value={`${fmt(load.kg)} kg`} />
                  <Info label={M.expected} value={t.yarn.socks(fmt(load.socks))} strong />
                  <Info label={M.loadedAt} value={`${formatDayTime(load.loadedAt)}${load.workerName ? ` · ${load.workerName}` : ""}`} />
                  <Info
                    label={M.readyAt}
                    value={`${formatDayTime(load.readyAt)}${leftMs === null ? "" : leftMs > 0 ? ` · ${M.remaining(Math.floor(leftMin / 60), leftMin % 60)}` : ` · ${M.readyNow}`}`}
                  />
                </div>
                {canManage && (
                  <div className="grid grid-cols-2 gap-2">
                    <ActionButton action={finishLoadNow.bind(null, load.id)} confirmText={M.finishNowConfirm} className="w-full h-10 text-green-700 border-green-200">
                      {M.finishNow}
                    </ActionButton>
                    <ActionButton action={cancelLoad.bind(null, load.id)} confirmText={M.cancelConfirm} variant="ghost" className="w-full h-10 text-gray-500 hover:text-rose-600">
                      {M.cancel}
                    </ActionButton>
                  </div>
                )}
              </div>
            )
          })}

          {adding ? (
            <LoadMachinesForm options={options} machineNumbers={String(machine.number)} lockNumbers onSuccess={onDone} />
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="w-full h-10 rounded-xl border border-dashed border-gray-300 text-sm font-bold text-gray-600 hover:bg-gray-50">
              {M.addMore}
            </button>
          )}

          {canManage && machine.loads.length === 0 && (
            <ActionButton action={setMachineActive.bind(null, machine.id, false)} variant="ghost" className="w-full text-gray-500">
              {M.setInactive}
            </ActionButton>
          )}
        </div>
      )}
    </>
  )
}

function Info({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-white p-2 min-w-0">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={cn("text-sm truncate", strong ? "font-black text-gray-900" : "font-semibold text-gray-700")}>{value}</p>
    </div>
  )
}
