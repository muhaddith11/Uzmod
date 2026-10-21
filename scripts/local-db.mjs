// Lokal ishlab chiqish bazasi: PGlite (WASM'dagi Postgres) ni oddiy Postgres
// serveri sifatida ochadi. Ma'lumotlar loyiha ichidagi .pglite-data/ papkasida.
// Port .env dagi DATABASE_URL'dan olinadi — 5432 kompyuterdagi PostgreSQL
// xizmatiga band bo'lgani uchun 5433 ishlatiladi.
//
// Ishga tushirish (alohida terminalda, dev serverdan oldin): npm run db:local
import "dotenv/config"
import { fileURLToPath } from "url"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"

const DATA_DIR = fileURLToPath(new URL("../.pglite-data", import.meta.url))
const PORT = Number(new URL(process.env.DATABASE_URL ?? "postgresql://localhost:5433").port || 5433)

const db = await PGlite.create(DATA_DIR)

// pglite-socket sukut bo'yicha faqat 1 ta ulanish qabul qiladi, ortig'ini yopib
// yuboradi. Prisma (pg Pool) 10 tagacha ulanish ochadi — shuning uchun zaxira bilan.
// So'rovlar baribir bitta navbatda ketma-ket bajariladi.
const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: PORT, maxConnections: 50 })
await server.start()
console.log(`PGlite tayyor: 127.0.0.1:${PORT} (ma'lumotlar: .pglite-data)`)

async function shutdown() {
  console.log("Baza to'xtatilmoqda...")
  await server.stop()
  await db.close()
  process.exit(0)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
