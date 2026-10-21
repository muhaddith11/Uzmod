import type { DefaultSession } from "next-auth"
import type { Role } from "@prisma/client"

declare module "next-auth" {
  interface User {
    organizationId: string
    role: Role
    sessionVersion: number
  }

  interface Session {
    user: {
      id: string
      organizationId: string
      role: Role
    } & DefaultSession["user"]
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    organizationId?: string
    role?: Role
    // User.sessionVersion — bazadagidan farq qilsa sessiya bekor bo'ladi
    sv?: number
  }
}
