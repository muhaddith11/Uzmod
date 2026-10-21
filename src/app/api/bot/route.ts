import { sendTelegramMessage, escapeHtml } from "@/lib/telegram";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  // Webhook so'rovini tekshirish — faqat Telegram serveridan kelgan bo'lishi kerak.
  // Secret sozlanmagan bo'lsa ham so'rovni rad etamiz (fail-closed): aks holda
  // istalgan odam bu endpointga POST qilib, bot nomidan xabar yubortira oladi.
  const secretToken = req.headers.get('x-telegram-bot-api-secret-token')
  const expectedToken = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expectedToken) {
    console.error("TELEGRAM_WEBHOOK_SECRET sozlanmagan — webhook so'rovi rad etildi")
    return new Response('Forbidden', { status: 403 })
  }
  if (secretToken !== expectedToken) {
    return new Response('Forbidden', { status: 403 })
  }

  const body = await req.json();
  const message = body.message;

  if (!message || !message.text) {
    return new Response('OK');
  }

  const chatId = message.chat.id.toString();
  const text = message.text;

  if (text === '/start') {
    // Foydalanuvchini bazadan qidirish
    const user = await prisma.user.findUnique({
      where: { telegramId: chatId },
      include: { organization: true }
    });

    if (user) {
      await sendTelegramMessage(chatId, `Assalomu alaykum, <b>${escapeHtml(user.name ?? "Foydalanuvchi")}</b>! \n\nSiz <b>${escapeHtml(user.organization.name)}</b> tizimiga muvaffaqiyatli ulandingiz. \n\nIshlab chiqarishni boshqarish uchun quyidagi tugmani bosing:`, {
        inline_keyboard: [
          [{ text: "📦 Ombor Boshqaruvi (Mini App)", web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/tma` } }]
        ]
      });
    } else {
      await sendTelegramMessage(chatId, `Assalomu alaykum! \n\nSiz hali tizimda ro'yxatdan o'tmagansiz yoki Telegram ID-ingiz ulanmagan. \n\nIltimos, avval web-sayt orqali profilingizni ulang. \n\nSizning Telegram ID: <code>${chatId}</code>`);
    }
  }

  return new Response('OK');
}
