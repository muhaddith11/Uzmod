'use client'

import { register } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useState } from "react"

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // onSubmit: <form action> React 19'da xato qaytganda ham maydonlarni tozalab yuborardi
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setLoading(true)
    setError(null)
    try {
      // Muvaffaqiyatda register() /login'ga yo'naltiradi
      const result = await register(formData)
      if (result.error) {
        setError(result.error)
        setLoading(false)
      }
    } catch {
      setError("Xatolik yuz berdi")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-none">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold tracking-tight">Ro'yxatdan o'tish</CardTitle>
          <CardDescription>
            SaaS tizimi uchun yangi tashkilot yarating
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-red-100 text-red-600 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="orgName">Tashkilot nomi</Label>
              <Input id="orgName" name="orgName" placeholder="Masalan: Golden Soft Sex" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Foydalanuvchi ismi</Label>
              <Input id="name" name="name" placeholder="Ismingizni kiriting" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email manzil</Label>
              <Input id="email" name="email" type="email" placeholder="name@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Parol</Label>
              <Input id="password" name="password" type="password" required />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700" type="submit" disabled={loading}>
              {loading ? "Yaratilmoqda..." : "Tashkilot yaratish"}
            </Button>
            <div className="text-center text-sm text-gray-500">
              Hisobingiz bormi?{" "}
              <Link href="/login" className="text-blue-600 hover:underline font-medium">
                Kirish
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
