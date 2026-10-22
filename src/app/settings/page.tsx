import { addDevice, deleteDevice, getSettings, updateModules } from "@/lib/actions/settings"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ActionForm } from "@/components/ui/action-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DeleteButton } from "@/components/ui/delete-button"
import { Field, inputClass } from "@/components/ui/field"
import { PageHeader } from "@/components/PageHeader"
import { getLocale, getT } from "@/i18n/server"
import { formatDateTime } from "@/lib/format"
import { Settings2Icon, ScanFaceIcon, LayoutGridIcon, InfoIcon } from "lucide-react"

export default async function SettingsPage() {
  const [t, locale, data] = await Promise.all([getT(), getLocale(), getSettings()])
  const S = t.settings

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <PageHeader icon={<Settings2Icon className="text-gray-600" />} title={S.title} subtitle={S.subtitle} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Card className="shadow-sm border-none bg-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><LayoutGridIcon className="w-5 h-5 text-indigo-600" />{S.modulesTitle}</CardTitle>
            <CardDescription>{S.modulesHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={updateModules} successMessage={S.modulesSaved} className="space-y-2">
              {data.modules.map(m => (
                <label key={m.key} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3 cursor-pointer hover:bg-gray-50">
                  <span className="text-sm font-semibold text-gray-800">{S.modules[m.key]}</span>
                  <input type="checkbox" name="modules" value={m.key} defaultChecked={m.enabled} className="w-5 h-5 accent-indigo-600" />
                </label>
              ))}
              <Button type="submit" className="w-full h-11 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold">{t.common.save}</Button>
            </ActionForm>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><ScanFaceIcon className="w-5 h-5 text-sky-600" />{S.devicesTitle}</CardTitle>
            <CardDescription>{S.devicesHint}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {data.devices.length > 0 && (
              <div className="space-y-2">
                {data.devices.map(d => {
                  const online = d.online
                  return (
                    <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">{d.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{d.serialNumber}</p>
                        <p className={`text-xs ${online ? "text-green-700 font-bold" : "text-gray-400"}`}>
                          {online ? S.online : d.lastSeenAt ? `${S.lastSeen}: ${formatDateTime(d.lastSeenAt, locale)}` : S.never}
                        </p>
                      </div>
                      <DeleteButton action={deleteDevice.bind(null, d.id)} confirmText={S.confirmDeleteDevice(d.name)} />
                    </div>
                  )
                })}
              </div>
            )}

            <ActionForm action={addDevice} successMessage={S.deviceAdded} className="space-y-3">
              <Field label={S.serialNumber} hint={S.serialHint}>
                <Input name="serialNumber" required className={`${inputClass} font-mono uppercase`} placeholder="CNXX123456789" />
              </Field>
              <Field label={S.deviceName}>
                <Input name="name" required className={inputClass} placeholder={S.deviceNamePlaceholder} />
              </Field>
              <Button type="submit" className="w-full h-11 bg-sky-600 hover:bg-sky-700 text-white font-bold">{S.addDevice}</Button>
            </ActionForm>

            <div className="rounded-xl bg-gray-50 p-4 space-y-2">
              <p className="text-sm font-bold text-gray-800">{S.setupTitle}</p>
              <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-600">
                {S.setupSteps.map(step => <li key={step}>{step}</li>)}
              </ol>
            </div>
            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 flex gap-2">
              <InfoIcon className="w-5 h-5 shrink-0 text-amber-600" />
              <div><p className="font-bold">{S.recommendTitle}</p><p>{S.recommendText}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {data.devices.length > 0 && (
        <Card className="shadow-sm border-none bg-white overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">{S.unknownPunches}</CardTitle>
            <CardDescription>{S.unknownHint}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="px-4 font-bold">{S.pin}</TableHead>
                  <TableHead className="px-4 font-bold">{S.lastPunch}</TableHead>
                  <TableHead className="px-4 font-bold text-right">#</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.unknownPins.map(u => (
                  <TableRow key={u.pin}>
                    <TableCell className="px-4 font-mono font-bold">{u.pin}</TableCell>
                    <TableCell className="px-4 text-sm text-gray-500">{u.lastPunch ? formatDateTime(u.lastPunch, locale) : t.common.none}</TableCell>
                    <TableCell className="px-4 text-right">{u.count}</TableCell>
                  </TableRow>
                ))}
                {data.unknownPins.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="h-20 text-center text-gray-400 italic">{S.noUnknown}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
