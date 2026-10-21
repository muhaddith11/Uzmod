import type { Locale } from "../locales"
import { common } from "./common"
import { errors, validation } from "./errors"
import { auth, nav, profile } from "./auth"
import { workers } from "./workers"
import { inventory, production, rolls } from "./inventory"
import { customers, sales, suppliers } from "./sales"
import { dashboard, exportsMsg, finance, history, reports, tma, warehouses } from "./finance"
import { attendance } from "./attendance"

const namespaces = {
  common,
  errors,
  validation,
  auth,
  nav,
  profile,
  workers,
  inventory,
  rolls,
  production,
  sales,
  customers,
  suppliers,
  finance,
  reports,
  dashboard,
  history,
  warehouses,
  tma,
  exports: exportsMsg,
  attendance,
}

type Namespaces = typeof namespaces
export type Messages = { [K in keyof Namespaces]: Namespaces[K]["uz"] }

function pick(locale: Locale): Messages {
  return Object.fromEntries(
    Object.entries(namespaces).map(([key, value]) => [key, value[locale]])
  ) as Messages
}

export const messages: Record<Locale, Messages> = {
  uz: pick("uz"),
  ru: pick("ru"),
}
