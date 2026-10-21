import fs from "node:fs"
import net from "node:net"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"

// Testlar uchun xotiradagi Postgres (PGlite): haqiqiy migratsiyalar qo'llanadi,
// Prisma esa oddiy Postgres serveriga ulangandek ishlaydi.

async function freePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as net.AddressInfo).port
      server.close(() => resolve(port))
    })
  })
}

export default async function setup() {
  const db = await PGlite.create()

  const migrationsDir = path.resolve(__dirname, "../prisma/migrations")
  const migrations = fs
    .readdirSync(migrationsDir)
    .filter(name => fs.statSync(path.join(migrationsDir, name)).isDirectory())
    .sort()
  for (const name of migrations) {
    await db.exec(fs.readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8"))
  }

  const port = await freePort()
  const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port, maxConnections: 20 })
  await server.start()

  // Fork'lar globalSetup'dan keyin ochiladi va shu muhit o'zgaruvchilarini meros oladi
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`
  process.env.DATABASE_POOL_MAX = "1"
  delete process.env.TELEGRAM_BOT_TOKEN

  return async () => {
    await server.stop()
    await db.close()
  }
}
