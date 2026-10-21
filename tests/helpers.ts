import { prisma } from "@/lib/prisma"
import { setTestUser, type TestUser } from "./session-state"

export function asUser(user: TestUser | null) {
  setTestUser(user)
}

export function form(data: Record<string, string | number | undefined | string[]>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue
    if (Array.isArray(value)) value.forEach(v => fd.append(key, v))
    else fd.append(key, String(value))
  }
  return fd
}

export async function resetDb() {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Organization", "RateLimit" CASCADE`)
}

/**
 * Paypoq sexi: ikki ombor, rulonli ip (kg), rulonsiz rezinka (metr), tayyor paypoq,
 * resept (0.05 kg ip + 0.5 m rezinka), admin, menejer va ikki ishchi.
 */
export async function seedWorkshop(name = "Test sex") {
  const org = await prisma.organization.create({ data: { name } })
  const mk = (role: TestUser["role"], email: string) =>
    prisma.user.create({ data: { email, name: email.split("@")[0], passwordHash: "x", role, organizationId: org.id } })
  const [admin, manager, worker, worker2] = await Promise.all([
    mk("ADMIN", `admin-${org.id}@t.uz`),
    mk("MANAGER", `manager-${org.id}@t.uz`),
    mk("WORKER", `worker-${org.id}@t.uz`),
    mk("WORKER", `worker2-${org.id}@t.uz`),
  ])
  const rawWh = await prisma.warehouse.create({ data: { name: "Xomashyo", organizationId: org.id } })
  const goodsWh = await prisma.warehouse.create({ data: { name: "Tayyor", organizationId: org.id } })

  const yarn = await prisma.product.create({
    data: { name: "Ip", unit: "kg", isRawMaterial: true, isRollTracked: true, costPrice: 0, organizationId: org.id },
  })
  const elastic = await prisma.product.create({
    data: { name: "Rezinka", unit: "metr", isRawMaterial: true, costPrice: 0, organizationId: org.id },
  })
  const sock = await prisma.product.create({
    data: { name: "Paypoq", unit: "juft", price: 12000, productionWage: 800, organizationId: org.id },
  })
  await prisma.bom.createMany({
    data: [
      { productId: sock.id, materialId: yarn.id, quantityNeeded: 0.05 },
      { productId: sock.id, materialId: elastic.id, quantityNeeded: 0.5 },
    ],
  })

  const user = (u: { id: string; role: TestUser["role"]; name: string | null }): TestUser =>
    ({ id: u.id, role: u.role, name: u.name, organizationId: org.id })

  return {
    org,
    admin: user(admin),
    manager: user(manager),
    worker: user(worker),
    worker2: user(worker2),
    rawWh,
    goodsWh,
    yarn,
    elastic,
    sock,
  }
}

export async function stockOf(productId: string, warehouseId: string) {
  const level = await prisma.stockLevel.findUnique({ where: { productId_warehouseId: { productId, warehouseId } } })
  return level?.quantity ?? 0
}

export async function costOf(productId: string) {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } })
  return Number(product.costPrice)
}
