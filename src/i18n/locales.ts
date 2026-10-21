export const LOCALES = ["uz", "ru"] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "uz"
export const LOCALE_COOKIE = "lang"

// Intl uchun to'liq til kodi (son, sana formatlash)
export const INTL_LOCALE: Record<Locale, string> = {
  uz: "uz-UZ",
  ru: "ru-RU",
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value)
}

/**
 * Bitta nom maydoni (namespace) uchun ikki tildagi matnlar. `ru` aynan `uz` shaklida
 * bo'lishi shart — biror kalit tarjimasiz qolsa, TypeScript xato beradi.
 */
export function ns<T>(messages: { uz: T; ru: NoInfer<T> }) {
  return messages
}
