'use client'

import { register } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { useT } from "@/i18n/client"
import Link from "next/link"
import { useState } from "react"

export default function RegisterPage() {
  const t = useT()
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
      setError(t.errors.generic)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-none">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-end"><LanguageSwitcher /></div>
          <CardTitle className="text-3xl font-bold tracking-tight">{t.auth.register}</CardTitle>
          <CardDescription>{t.auth.registerSubtitle}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div role="alert" className="p-3 bg-red-100 text-red-600 rounded-lg text-sm font-medium">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="orgName">{t.auth.orgName}</Label>
              <Input id="orgName" name="orgName" placeholder={t.auth.orgNamePlaceholder} required className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{t.auth.userName}</Label>
              <Input id="name" name="name" autoComplete="name" placeholder={t.auth.userNamePlaceholder} required className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t.auth.email}</Label>
              <Input id="email" name="email" type="email" autoComplete="email" placeholder="name@example.com" required className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.auth.password}</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="h-11" />
              <p className="text-xs text-gray-500">{t.validation.passwordMin(8)}</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700" type="submit" disabled={loading}>
              {loading ? t.auth.creating : t.auth.createOrg}
            </Button>
            <div className="text-center text-sm text-gray-500">
              {t.auth.haveAccount}{" "}
              <Link href="/login" className="text-blue-600 hover:underline font-medium">
                {t.auth.signIn}
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
