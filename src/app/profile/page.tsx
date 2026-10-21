import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { startTelegramLink } from "@/lib/actions/profile"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { UserIcon, SendIcon, CheckCircle2Icon } from "lucide-react"

export default async function ProfilePage() {
  const session = await auth()
  const user = await prisma.user.findUnique({
    where: { id: session?.user?.id },
    include: { organization: true }
  })

  if (!user) return null

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <UserIcon className="w-8 h-8 text-blue-600" />
          Mening Profilim
        </h1>
        <p className="text-gray-500">Shaxsiy ma'lumotlar va integratsiyalar</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle>Asosiy Ma'lumotlar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Ism-sharif</label>
              <p className="text-lg font-bold text-gray-900">{user.name}</p>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Email</label>
              <p className="text-lg font-bold text-gray-900">{user.email}</p>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Tashkilot</label>
              <p className="text-lg font-bold text-indigo-600">{user.organization.name}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-blue-50/50">
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <SendIcon className="w-5 h-5" />
              Telegram Integratsiyasi
            </CardTitle>
            <CardDescription>Mini App orqali ishlatish uchun ulaning</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {user.telegramId ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="bg-green-100 p-4 rounded-full">
                  <CheckCircle2Icon className="w-12 h-12 text-green-600" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-gray-900 text-xl">Ulangan!</p>
                  <p className="text-sm text-gray-500">ID: {user.telegramId}</p>
                </div>
                <p className="text-center text-xs text-gray-400 italic">Endi Telegram bot orqali tizimga kira olasiz.</p>
                <form action={startTelegramLink}>
                  <Button type="submit" variant="outline" className="h-9 text-xs">
                    Boshqa Telegram hisobiga ulash
                  </Button>
                </form>
              </div>
            ) : (
              <form action={startTelegramLink} className="space-y-4">
                <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl text-sm text-orange-700">
                  Tugmani bosing — Telegram'da botimiz ochiladi. U yerda <b>Start</b> ni bosing,
                  hisobingiz avtomatik ulanadi. Havola 15 daqiqa amal qiladi. So'ng bu sahifani yangilang.
                </div>
                <Button type="submit" className="w-full bg-blue-600 h-12 font-bold transition-all hover:bg-blue-700">
                  Telegram'ni ulash
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
