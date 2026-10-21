import crypto from 'crypto';

export function validateTelegramWebAppData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400 // 24 soat — eski initData qayta ishlatilmasin (replay himoyasi)
): boolean {
  if (!initData) return false;

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  if (!hash) return false;
  urlParams.delete('hash');

  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (calculatedHash !== hash) return false;

  // HMAC to'g'ri — endi auth_date yangi ekanini tekshiramiz.
  // Aks holda bir marta oqib chiqqan initData abadiy amal qilardi.
  const authDate = Number(urlParams.get('auth_date'));
  if (!Number.isFinite(authDate) || authDate <= 0) return false;
  const ageSeconds = Date.now() / 1000 - authDate;
  if (ageSeconds > maxAgeSeconds) return false;

  return true;
}

/**
 * Faqat foydalanuvchi kiritgan qiymatlar uchun (ism, mahsulot nomi va h.k.).
 * Butun xabarga qo'llamang — aks holda xabardagi <b> teglar ham buziladi.
 * Chaqiruvchilar interpolatsiya qilinadigan qiymatlarni shu bilan o'raydi.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function sendTelegramMessage(chatId: string, text: string, replyMarkup?: any): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'YOUR_BOT_TOKEN_HERE') return false;
  if (!chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        // Matn o'zgartirilmaydi — <b>/<code> teglar ishlashi uchun.
        // Foydalanuvchi qiymatlari chaqiruvchida escapeHtml bilan tozalanadi.
        text,
        reply_markup: replyMarkup,
        parse_mode: 'HTML'
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) {
      // Token URL logga tushmaydi, faqat status kodi
      console.error(`[Telegram] Xabar yuborilmadi. Status: ${res.status}`);
      return false;
    }

    return true;
  } catch (err: any) {
    // AbortError = timeout, NetworkError = tarmoq muammosi
    console.error(`[Telegram] Ulanish xatosi: ${err.name}`);
    return false;
  }
}
