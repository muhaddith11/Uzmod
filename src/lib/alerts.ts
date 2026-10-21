import { prisma } from "@/lib/prisma"
import { sendTelegramMessage, escapeHtml } from "@/lib/telegram"
import { messages } from "@/i18n/messages"
import { formatNumber } from "@/lib/format"

/**
 * Qoldiq minimal limitdan pastga TUSHGAN paytda (avval yuqori edi) barcha faol
 * adminlarga Telegram xabari yuboradi. Har amalda qayta-qayta yuborilmaydi.
 * `decreasedBy` — shu amalda qancha kamaydi (oldingi qoldiqni topish uchun).
 */
export async function checkLowStock(productId: string, organizationId: string, decreasedBy: number) {
  if (!(decreasedBy > 0)) return

  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId },
    include: {
      stockLevels: true,
      organization: {
        include: { users: { where: { role: 'ADMIN', isActive: true, telegramId: { not: null } } } }
      }
    }
  })

  const minLevel = Number(product?.minStockLevel ?? 0)
  if (!product || minLevel <= 0) return

  const totalQty = product.stockLevels.reduce((acc, sl) => acc + sl.quantity, 0)
  const previousQty = totalQty + decreasedBy
  if (!(totalQty <= minLevel && previousQty > minLevel)) return

  // Bot xabarlari o'zbekcha: adminning tilini bilmaymiz
  const t = messages.uz
  const text = t.inventory.lowStockAlert(
    escapeHtml(product.name),
    formatNumber(totalQty, "uz"),
    escapeHtml(product.unit),
    formatNumber(minLevel, "uz"),
  )

  await Promise.all(
    product.organization.users.map(admin =>
      sendTelegramMessage(admin.telegramId!, text).catch(error => {
        console.error("Telegram xabar yuborishda xato:", error)
        return false
      })
    )
  )
}
