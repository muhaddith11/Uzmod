import { cache } from "react"
import { cookies } from "next/headers"
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./locales"
import { messages, type Messages } from "./messages"

/** Joriy til — `lang` cookie'dan (bo'lmasa o'zbekcha). Bitta so'rov ichida keshlanadi. */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value
  return isLocale(value) ? value : DEFAULT_LOCALE
})

/** Server komponent va server action'lar uchun tarjimalar */
export async function getT(): Promise<Messages> {
  return messages[await getLocale()]
}
