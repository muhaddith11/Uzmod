import { vi } from "vitest"

// Next.js so'rov konteksti testda yo'q — sessiya, cookie va keshni almashtiramiz.

vi.mock("@/auth", async () => {
  const state = await import("./session-state")
  return {
    auth: async () => state.getTestSession(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    GET: vi.fn(),
    POST: vi.fn(),
  }
})

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, has: () => false }),
  headers: async () => new Headers({ "x-forwarded-for": "127.0.0.1" }),
}))
