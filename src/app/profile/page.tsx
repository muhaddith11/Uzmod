import { ActionForm } from "@/components/ui/action-form"
import { prisma } from "@/lib/prisma"
import { getSessionUser } from "@/lib/session"
import { changeOwnPassword, startTelegramLink } from "@/lib/actions/profile"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, inputClass } from "@/components/ui/field"
import { PageHeader } from "@/components/PageHeader"
import { getT } from "@/i18n/server"
import { UserIcon, SendIcon, CheckCircle2Icon, KeyRoundIcon } from "lucide-react"

export default async function ProfilePage() {
  const me = await getSessionUser()
  const t = await getT()
  const P = t.profile
  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: { name: true, email: true, role: true, telegramId: true, organization: { select: { name: true } } }
  })
  if (!user) return null

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      <PageHeader icon={<UserIcon className="text-blue-600" />} title={P.title} subtitle={P.subtitle} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{P.basicInfo}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Info label={P.fullName} value={user.name ?? "—"} />
            <Info label={t.auth.email} value={user.email ?? "—"} />
            <Info label={P.organization} value={user.organization.name} accent />
            <Info label={P.role} value={t.common.roles[user.role]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRoundIcon className="w-5 h-5 text-indigo-600" />
              {P.changePassword}
            </CardTitle>
            <CardDescription>{P.changePasswordHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={changeOwnPassword} className="space-y-4">
              <Field label={P.currentPassword}>
                <Input name="currentPassword" type="password" autoComplete="current-password" required className={inputClass} />
              </Field>
              <Field label={P.newPassword} hint={t.validation.passwordMin(8)}>
                <Input name="newPassword" type="password" autoComplete="new-password" minLength={8} required className={inputClass} />
              </Field>
              <Field label={P.repeatPassword}>
                <Input name="repeatPassword" type="password" autoComplete="new-password" minLength={8} required className={inputClass} />
              </Field>
              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 h-11 font-bold">
                {P.changePassword}
              </Button>
            </ActionForm>
          </CardContent>
        </Card>

        <Card className="overflow-hidden md:col-span-2 pb-0">
          <CardHeader className="bg-blue-50/50">
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <SendIcon className="w-5 h-5" />
              {P.telegramTitle}
            </CardTitle>
            <CardDescription>{P.telegramSubtitle}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {user.telegramId ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="bg-green-100 p-4 rounded-full">
                  <CheckCircle2Icon className="w-12 h-12 text-green-600" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-gray-900 text-xl">{P.telegramLinked}</p>
                  <p className="text-sm text-gray-500">ID: {user.telegramId}</p>
                </div>
                <p className="text-center text-xs text-gray-400 italic">{P.telegramLinkedHint}</p>
                <ActionForm action={startTelegramLink}>
                  <Button type="submit" variant="outline" className="h-9 text-xs">{P.telegramRelink}</Button>
                </ActionForm>
              </div>
            ) : (
              <ActionForm action={startTelegramLink} className="space-y-4 max-w-md">
                <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl text-sm text-orange-700">
                  {P.telegramHowTo}
                </div>
                <Button type="submit" className="w-full bg-blue-600 h-12 font-bold transition-all hover:bg-blue-700">
                  {P.telegramConnect}
                </Button>
              </ActionForm>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Info({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase">{label}</p>
      <p className={`text-lg font-bold ${accent ? "text-indigo-600" : "text-gray-900"}`}>{value}</p>
    </div>
  )
}
