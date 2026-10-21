import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Sahifalarni himoya qiladi: kirmaganlarni /login'ga, rolga mos kelmaganlarni
// bosh sahifaga yuboradi (qoidalar auth.config.ts dagi authorized callback'da).
export default NextAuth(authConfig).auth;

export const config = {
  // /api (NextAuth, Telegram webhook) va statik fayllar tekshirilmaydi
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
