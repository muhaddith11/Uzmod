# Uzmod Ombor

Tikuv (paypoq) sexi uchun ombor, ishlab chiqarish va savdo tizimi. Bir nechta
tashkilot bitta o'rnatmada ishlaydi (multi-tenant). Interfeys o'zbek va rus tillarida.

**Imkoniyatlar:** katalog va qoldiqlar (omborlar bo'yicha), rulonlarni partiya bilan
qabul qilish va FIFO sarflash, resept (BOM) bo'yicha ishlab chiqarish, ko'p qatorli
sotuv (naqd/karta/nasiya) va uni bekor qilish, mijozlar qarzi, ta'minotchilar va
ularga qarz, omborlar orasida ko'chirish, xarajatlar, ishbay haq va bonus/jarima,
moliyaviy hisobot, Word (.docx) hisobotlar, Telegram Mini App.

**Rollar:** `ADMIN` (hammasi), `MANAGER` (sotuv, mijoz, ta'minotchi, xodim — moliyasiz),
`WORKER` (tikuv va rulon qabul qilish; narxlarni ko'rmaydi).

## Texnologiyalar

Next.js 16 (App Router, server actions) · React 19 · Prisma 7 + PostgreSQL (Neon) ·
NextAuth v5 (JWT) · Tailwind 4 · zod · docx · Vitest.

## Lokal ishga tushirish

```bash
npm install
npm run db:local   # alohida terminalda: PGlite, 127.0.0.1:5433, ma'lumot .pglite-data/ da
npx prisma migrate deploy
npm run db:seed    # admin@test.com / admin123
npm run dev
```

`.env` da kerak: `DATABASE_URL`, `AUTH_SECRET` (yoki `NEXTAUTH_SECRET`),
Telegram uchun `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`.

## Buyruqlar

| Buyruq | Nima qiladi |
| --- | --- |
| `npm run dev` | Dev server |
| `npm test` | Unit va integratsion testlar (o'zi xotirada PGlite ko'taradi) |
| `npm run typecheck` / `npm run lint` | TypeScript va ESLint |
| `npm run db:migration -- nom` | Sxema o'zgarishidan yangi migratsiya yaratadi va lokal qo'llaydi |
| `npm run vercel-build` | `prisma migrate deploy && next build` (Vercel shuni ishlatadi) |

## Hisob-kitob qoidalari

- **Tannarx** — o'rtacha tortilgan: har bir kirim (narx bilan), ishlab chiqarish va
  qaytarishda qayta hisoblanadi. Tayyor mahsulot tannarxi = resept bo'yicha xomashyo + ishbay haq.
- **Sof foyda** = savdo − sotilgan mahsulot tannarxi − operatsion xarajatlar − bonus/jarima.
  Ishbay haq tannarx ichida, alohida ayirilmaydi.
- Xomashyo xaridi xarajat sifatida yozilmaydi — u kirim narxi orqali tannarxga kiradi.
- Sanalar va kun chegaralari Toshkent vaqtida (UTC+5).

## Xavfsizlik

Har bir server action sessiya, rol va tashkilotni o'zi tekshiradi. Xodim bloklansa yoki
paroli almashtirilsa (`sessionVersion`) uning sessiyalari darhol bekor bo'ladi. Login va
ro'yxatdan o'tish urinishlari bazadagi hisoblagich bilan cheklangan. Telegram webhook
maxfiy kalitsiz so'rovlarni rad etadi.
