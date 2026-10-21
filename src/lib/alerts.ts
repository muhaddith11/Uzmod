import { prisma } from "@/lib/prisma"
import { sendTelegramMessage, escapeHtml } from "@/lib/telegram"

export async function checkLowStock(productId: string, organizationId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId },
    include: {
      stockLevels: true,
      organization: { include: { users: { where: { role: 'ADMIN' } } } }
    }
  })

  // minStockLevel — Prisma Decimal, taqqoslash uchun songa o'giramiz
  const minLevel = Number(product?.minStockLevel ?? 0)
  if (!product || minLevel <= 0) return

  const totalQty = product.stockLevels.reduce((acc, sl) => acc + sl.quantity, 0)

  if (totalQty <= minLevel) {
    const admin = product.organization.users[0]
    if (admin && admin.telegramId) {
      const name = escapeHtml(product.name)
      const unit = escapeHtml(product.unit)
      const message = `⚠️ <b>DIQQAT: QOLDIQ KAMAYDI</b>\n\n` +
                      `📦 Mahsulot: <b>${name}</b>\n` +
                      `📉 Hozirgi qoldiq: <b>${totalQty} ${unit}</b>\n` +
                      `🔔 Minimal limit: <b>${minLevel} ${unit}</b>\n\n` +
                      `Iltimos, zaxirani to'ldiring!`
      
      try {
        await sendTelegramMessage(admin.telegramId, message)
      } catch (error) {
        console.error("Telegram xabar yuborishda xato:", error)
      }
    }
  }
}
