import { unstable_rethrow } from "next/navigation"
import { getT } from "@/i18n/server"

/**
 * Foydalanuvchiga ko'rsatiladigan xato (validatsiya, ruxsat va h.k.).
 * Oddiy Error matni production'da Next.js tomonidan yashiriladi — shuning uchun
 * action() faqat shu turdagi xatolarni matni bilan qaytaradi.
 */
export class ActionError extends Error {}

export type ActionResult = { error?: string }

/**
 * Server action'ni o'raydi: ActionError'ni otish o'rniga { error } qaytaradi,
 * forma uni production'da ham ko'rsata oladi. Kutilmagan xatolar (baza va h.k.)
 * logga yoziladi, foydalanuvchiga esa umumiy xabar boradi — ichki tafsilot chiqmaydi.
 */
export function action<Args extends unknown[]>(fn: (...args: Args) => Promise<unknown>) {
  return async (...args: Args): Promise<ActionResult> => {
    try {
      await fn(...args)
      return {}
    } catch (err) {
      // redirect() va notFound() — Next'ning boshqaruv "xato"lari, ular o'tib ketishi kerak
      unstable_rethrow(err)

      if (err instanceof ActionError) return { error: err.message }

      const t = await getT()
      // SERIALIZABLE tranzaksiyalar bir vaqtda to'qnashdi
      if ((err as { code?: string })?.code === "P2034") {
        return { error: t.errors.conflict }
      }

      console.error("ACTION_ERROR:", err)
      return { error: t.errors.generic }
    }
  }
}
