import { sendTelegramMessage, escapeHtml } from "@/lib/telegram";
import { prisma } from "@/lib/prisma";

function miniAppKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "📦 Ombor Boshqaruvi (Mini App)", web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/tma` } }]
    ]
  };
}

/**
 * /start <token> — Profil sahifasidagi "Telegram'ni ulash" havolasidan keladi.
 * Token qaysi hisobniki bo'lsa, xabar yuborgan odamning Telegram ID'si o'sha hisobga yoziladi.
 */
async function linkByToken(message: any, token: string) {
  const chatId = message.chat.id.toString();

  // Faqat shaxsiy chatda: guruhda chat.id foydalanuvchiniki emas
  if (message.chat.type !== 'private' || !message.from?.id) return;
  const telegramId = message.from.id.toString();

  const user = await prisma.user.findUnique({
    where: { telegramLinkToken: token },
    include: { organization: true }
  });

  if (!user || !user.telegramLinkTokenExpiresAt || user.telegramLinkTokenExpiresAt < new Date()) {
    await sendTelegramMessage(chatId, `Havola eskirgan yoki noto'g'ri. \n\nSaytdagi Profil sahifasida «Telegram'ni ulash» tugmasini qayta bosing.`);
    return;
  }

  const linkedToOther = await prisma.user.findFirst({
    where: { telegramId, id: { not: user.id } }
  });
  if (linkedToOther) {
    await sendTelegramMessage(chatId, `Bu Telegram hisobi tizimdagi boshqa foydalanuvchiga ulangan. \n\nAdministratorga murojaat qiling.`);
    return;
  }

  // Token where'da — bir xil havola ikki marta ishlatilmaydi
  const { count } = await prisma.user.updateMany({
    where: { id: user.id, telegramLinkToken: token },
    data: { telegramId, telegramLinkToken: null, telegramLinkTokenExpiresAt: null }
  });
  if (count === 0) return;

  await sendTelegramMessage(
    chatId,
    `✅ Telegram hisobingiz <b>${escapeHtml(user.name ?? user.email)}</b> profiliga ulandi (<b>${escapeHtml(user.organization.name)}</b>). \n\nIshlab chiqarishni boshqarish uchun quyidagi tugmani bosing:`,
    miniAppKeyboard()
  );
}

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
  const text: string = message.text.trim();

  const [command, payload] = text.split(/\s+/, 2);
  if (command === '/start' && payload) {
    try {
      await linkByToken(message, payload);
    } catch (error) {
      console.error("TELEGRAM_LINK_ERROR:", error);
    }
    return new Response('OK');
  }

  if (text === '/start') {
    // Foydalanuvchini bazadan qidirish
    const user = await prisma.user.findUnique({
      where: { telegramId: chatId },
      include: { organization: true }
    });

    if (user) {
      await sendTelegramMessage(chatId, `Assalomu alaykum, <b>${escapeHtml(user.name ?? "Foydalanuvchi")}</b>! \n\nSiz <b>${escapeHtml(user.organization.name)}</b> tizimiga muvaffaqiyatli ulandingiz. \n\nIshlab chiqarishni boshqarish uchun quyidagi tugmani bosing:`, miniAppKeyboard());
    } else {
      await sendTelegramMessage(chatId, `Assalomu alaykum! \n\nSiz hali tizimda ro'yxatdan o'tmagansiz yoki Telegram hisobingiz ulanmagan. \n\nSaytga kiring va Profil sahifasida «Telegram'ni ulash» tugmasini bosing — bot sizni avtomatik ulaydi.`);
    }
  }

  return new Response('OK');
}
