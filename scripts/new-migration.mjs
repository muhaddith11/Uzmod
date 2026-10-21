// Yangi migratsiya yaratadi: `npm run db:migration -- nom`
//
// `prisma migrate dev` PGlite bilan ishlamaydi (shadow baza yaratib bo'lmaydi),
// shuning uchun lokal baza (u mavjud migratsiyalar bilan bir xil bo'lishi kerak)
// prisma/schema.prisma bilan solishtiriladi, farq yangi migratsiya fayliga yoziladi
// va `migrate deploy` bilan lokal bazaga qo'llanadi. Production'da Vercel build
// vaqtida `prisma migrate deploy` uni o'zi qo'llaydi.
//
// Avval: npm run db:local (alohida terminalda)
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const name = (process.argv[2] ?? "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_")
if (!name) {
  console.error("Migratsiya nomini bering: npm run db:migration -- add_something")
  process.exit(1)
}

execSync("npx prisma migrate deploy", { stdio: "inherit" })

const sql = execSync(
  "npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script",
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
)

if (!sql.trim() || /empty migration/i.test(sql)) {
  console.log("Sxemada o'zgarish yo'q — migratsiya yaratilmadi.")
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14)
const dir = path.join("prisma", "migrations", `${stamp}_${name}`)
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, "migration.sql"), sql)
console.log(`Yaratildi: ${dir}/migration.sql`)

execSync("npx prisma migrate deploy", { stdio: "inherit" })
