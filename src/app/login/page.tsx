'use client'

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { useT } from "@/i18n/client"
import Link from "next/link"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"

function LoginForm() {
  const t = useT()
  const params = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const notice =
    params.get("registered") ? t.auth.registered
    : params.get("changed") ? t.auth.passwordChanged
    : null

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)

    try {
      const result = await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirect: false,
      })

      if (result?.error) {
        setError(
          result.code === "blocked" ? t.auth.blocked
          : result.code === "rate_limited" ? t.auth.tooMany
          : t.auth.wrongCredentials
        )
        setLoading(false)
      } else {
        router.push("/")
        router.refresh()
      }
    } catch {
      setError(t.errors.generic)
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md shadow-xl border-none">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-end"><LanguageSwitcher /></div>
        <CardTitle className="text-3xl font-bold tracking-tight">{t.auth.welcome}</CardTitle>
        <CardDescription>{t.auth.signInSubtitle}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {notice && !error && (
            <div role="status" className="p-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium">{notice}</div>
          )}
          {error && (
            <div role="alert" className="p-3 bg-red-100 text-red-600 rounded-lg text-sm font-medium">{error}</div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">{t.auth.email}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" placeholder="name@example.com" required className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t.auth.password}</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-11" />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700" type="submit" disabled={loading}>
            {loading ? t.auth.signingIn : t.auth.signIn}
          </Button>
          <div className="text-center text-sm text-gray-500">
            {t.auth.noAccount}{" "}
            <Link href="/register" className="text-blue-600 hover:underline font-medium">
              {t.auth.register}
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}
