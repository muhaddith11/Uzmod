'use client'

import { createContext, useContext } from "react"
import { DEFAULT_LOCALE, type Locale } from "./locales"
import { messages, type Messages } from "./messages"

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE)

/**
 * Client komponentlarga tilni yetkazadi. Lug'atning o'zi prop sifatida uzatilmaydi —
 * unda funksiyalar bor, ular serverdan client'ga o'tmaydi. Shuning uchun client
 * ikkala lug'atni o'zi import qiladi va faqat til kodini oladi.
 */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export function useLocale(): Locale {
  return useContext(LocaleContext)
}

export function useT(): Messages {
  return messages[useContext(LocaleContext)]
}
