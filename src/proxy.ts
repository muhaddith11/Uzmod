// Sahifalarni himoya qiladi: kirmaganlarni /login'ga, rolga mos kelmaganlarni
// bosh sahifaga yuboradi (qoidalar auth.config.ts dagi authorized callback'da).
// Proxy Node.js runtime'da ishlaydi, shuning uchun to'liq auth (bazadan xodim
// holatini tekshirish bilan) shu yerda ham ishlatiladi — bloklangan xodim darhol chiqadi.
import { auth } from "@/auth"

export default auth

export const config = {
  // /api (NextAuth, Telegram webhook, eksport) va statik fayllar tekshirilmaydi —
  // API route'lar o'zi sessiyani tekshiradi
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
}
