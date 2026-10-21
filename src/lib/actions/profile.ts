'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

export async function linkTelegram(telegramId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Avtorizatsiya kerak")

  await prisma.user.update({
    where: { id: session.user.id },
    data: { telegramId }
  })

  revalidatePath("/profile")
}
