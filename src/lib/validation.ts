import { z } from "zod"
import { ActionError } from "@/lib/action"
import type { Messages } from "@/i18n/messages"

const MAX_ABS = 1e12

/** "1 000,5" → 1000.5; bo'sh satr → undefined (majburiy maydon xatosi chiqadi) */
function toNumberInput(value: unknown): unknown {
  if (typeof value === "number") return value
  if (typeof value !== "string") return undefined
  const cleaned = value.replace(/\s/g, "").replace(",", ".")
  if (cleaned === "") return undefined
  return Number(cleaned)
}

function toOptionalString(value: unknown): unknown {
  if (value === null || value === undefined) return undefined
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed
}

/**
 * Formalar uchun maydon qurilmalari. Xato matnlari joriy tilda va maydon nomi bilan
 * chiqadi, masalan: "Miqdor: 0 dan katta bo'lishi kerak".
 */
export function fields(t: Messages) {
  const V = t.validation

  const number = (label: string) =>
    z
      .number({ error: V.number(label) })
      .min(-MAX_ABS, V.tooLarge(label))
      .max(MAX_ABS, V.tooLarge(label))

  return {
    id: (label: string) => z.string({ error: V.required(label) }).trim().min(1, V.required(label)),
    optionalId: () => z.preprocess(toOptionalString, z.string().optional()),
    text: (label: string, max = 200) =>
      z.string({ error: V.required(label) }).trim().min(1, V.required(label)).max(max, V.tooLong(label, max)),
    optionalText: (label: string, max = 500) =>
      z.preprocess(toOptionalString, z.string().max(max, V.tooLong(label, max)).optional()),
    email: () => z.string({ error: V.email }).trim().toLowerCase().pipe(z.email({ error: V.email })),
    newPassword: () => z.string({ error: V.passwordMin(8) }).min(8, V.passwordMin(8)).max(200, V.tooLong(t.auth.password, 200)),
    anyNumber: (label: string) => z.preprocess(toNumberInput, number(label)),
    positive: (label: string) => z.preprocess(toNumberInput, number(label).gt(0, V.positive(label))),
    nonNegative: (label: string) => z.preprocess(toNumberInput, number(label).min(0, V.nonNegative(label))),
    optionalNonNegative: (label: string) =>
      z.preprocess(toNumberInput, number(label).min(0, V.nonNegative(label)).optional()),
    checkbox: () => z.preprocess(v => v === "on" || v === "true" || v === true, z.boolean()),
    oneOf: <const T extends readonly [string, ...string[]]>(label: string, values: T) =>
      z.enum(values, { error: V.invalidOption(label) }),
  }
}

/** FormData'dan oddiy obyekt (fayllar e'tiborga olinmaydi, takroriy kalitlarda oxirgisi) */
export function formToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") result[key] = value
  }
  return result
}

/** Sxema bo'yicha tekshiradi; xato bo'lsa birinchi xabar bilan ActionError otadi */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new ActionError(result.error.issues[0]?.message ?? "Invalid input")
  }
  return result.data
}

export function parseForm<S extends z.ZodType>(schema: S, formData: FormData): z.output<S> {
  return parseInput(schema, formToObject(formData))
}
