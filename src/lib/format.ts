import { INTL_LOCALE, type Locale } from "@/i18n/locales"
import { tashkentDateKey, tashkentTimeKey } from "@/lib/tz"

// O'zbekiston vaqti (UTC+5, yozgi vaqt yo'q). Vercel serveri UTC'da ishlaydi —
// sanalar shu zonada ko'rsatilmasa, kechki yozuvlar ertasi kunga o'tib qoladi.
export const TIME_ZONE = "Asia/Tashkent"

type Numeric = number | string | { toString(): string } | null | undefined

export function toNumber(value: Numeric): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === "number" ? value : Number(value.toString())
  return Number.isFinite(n) ? n : 0
}

// Server (Node) va brauzerning ICU ma'lumotlari o'zbekcha uchun farq qiladi ("1 000" va
// "1,000") — sahifa qayta chizilmasligi uchun ajratgichlar o'zimizda belgilanadi.
// O'zbekiston va Rossiyada: ming — bo'shliq, kasr — vergul.
const SEPARATORS: Record<Locale, { group: string; decimal: string }> = {
  uz: { group: " ", decimal: "," },
  ru: { group: " ", decimal: "," },
}

export function formatNumber(value: Numeric, locale: Locale, maxFractionDigits = 2): string {
  const sep = SEPARATORS[locale]
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: maxFractionDigits })
    .formatToParts(toNumber(value))
    .map(part => (part.type === "group" ? sep.group : part.type === "decimal" ? sep.decimal : part.value))
    .join("")
}

export function formatMoney(value: Numeric, locale: Locale): string {
  const currency = locale === "ru" ? "сум" : "so'm"
  return `${formatNumber(value, locale, 0)} ${currency}`
}

export function formatDate(value: Date | string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value))
}

export function formatDateTime(value: Date | string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value))
}

export function formatShortDay(value: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
  }).format(value)
}

/** Pul summasini tiyingacha yaxlitlaydi (float yig'ilish xatolarini kesadi) */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function formatTime(value: Date | string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value))
}

/** "22.10 08:00" — Toshkent vaqtida, yilsiz (tilga bog'liq emas — server va brauzerda bir xil) */
export function formatDayTime(value: Date | string): string {
  const date = new Date(value)
  const [, month, day] = tashkentDateKey(date).split("-")
  return `${day}.${month} ${tashkentTimeKey(date)}`
}
