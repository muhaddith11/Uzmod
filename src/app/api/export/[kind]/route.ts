import { prisma } from "@/lib/prisma"
import { ActionError } from "@/lib/action"
import { requireRole, type Role } from "@/lib/session"
import { buildWorkbook, type ExcelColumn } from "@/lib/excel"
import { parseDateRange, tashkentDateKey, type DateRangeParams } from "@/lib/tz"
import { getFinancialSummary } from "@/lib/actions/reports"
import { getWorkerEarnings } from "@/lib/actions/workers"
import { getT } from "@/i18n/server"
import type { Messages } from "@/i18n/messages"

// /api proxy'dan o'tmaydi — sessiya va rol har bir eksportda shu yerda tekshiriladi

type Sheet = { name: string; columns: ExcelColumn[]; rows: Record<string, unknown>[] }
type Builder = { roles: Role[]; build: (orgId: string, range: DateRangeParams, t: Messages) => Promise<Sheet> }

const MAX_ROWS = 20_000

const who = (u: { name: string | null; email: string } | null) => u?.name ?? u?.email ?? ""

const BUILDERS: Record<string, Builder> = {
  sales: {
    roles: ["ADMIN", "MANAGER"],
    async build(orgId, range, t) {
      const createdAt = parseDateRange(range)
      const sales = await prisma.sale.findMany({
        where: { organizationId: orgId, ...(createdAt ? { createdAt } : {}) },
        include: {
          customer: { select: { name: true } },
          warehouse: { select: { name: true } },
          createdBy: { select: { name: true, email: true } },
          items: { include: { product: { select: { name: true, unit: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: MAX_ROWS,
      })
      return {
        name: t.exports.sheetSales,
        columns: [
          { header: t.common.date, key: "date", kind: "datetime" },
          { header: t.common.customer, key: "customer" },
          { header: t.common.warehouse, key: "warehouse" },
          { header: t.sales.colItems, key: "items", width: 50 },
          { header: t.sales.colTotal, key: "total", kind: "money" },
          { header: t.sales.colPaid, key: "paid", kind: "money" },
          { header: t.customers.debt, key: "debt", kind: "money" },
          { header: t.sales.colPayment, key: "payment" },
          { header: t.sales.colStatus, key: "status" },
          { header: t.sales.by, key: "by" },
        ],
        rows: sales.map(s => ({
          date: s.createdAt,
          customer: s.customer?.name ?? "",
          warehouse: s.warehouse?.name ?? "",
          items: s.items.map(i => `${i.product.name} × ${i.quantity} ${i.product.unit} @ ${Number(i.price)}`).join("; "),
          total: Number(s.totalAmount),
          paid: Number(s.paidAmount),
          debt: Number(s.totalAmount) - Number(s.paidAmount),
          payment: t.sales.payment[s.paymentType],
          status: s.status === "ACTIVE" ? t.sales.statusActive : `${t.sales.statusCancelled}: ${s.cancelReason ?? ""}`,
          by: who(s.createdBy),
        })),
      }
    },
  },

  movements: {
    roles: ["ADMIN", "MANAGER"],
    async build(orgId, range, t) {
      const createdAt = parseDateRange(range)
      const movements = await prisma.stockMovement.findMany({
        where: { organizationId: orgId, ...(createdAt ? { createdAt } : {}) },
        include: {
          product: { select: { name: true, unit: true } },
          fromWarehouse: { select: { name: true } },
          toWarehouse: { select: { name: true } },
          creator: { select: { name: true, email: true } },
          worker: { select: { name: true, email: true } },
          supplier: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: MAX_ROWS,
      })
      return {
        name: t.exports.sheetMovements,
        columns: [
          { header: t.common.date, key: "date", kind: "datetime" },
          { header: t.history.colType, key: "type" },
          { header: t.history.colProduct, key: "product" },
          { header: t.history.colQty, key: "quantity", kind: "number" },
          { header: t.inventory.unit, key: "unit", width: 8 },
          { header: t.inventory.fromWarehouse, key: "from" },
          { header: t.inventory.toWarehouse, key: "to" },
          { header: t.inventory.colCost, key: "unitCost", kind: "money" },
          { header: t.common.supplier, key: "supplier" },
          { header: t.common.worker, key: "worker" },
          { header: t.history.colNote, key: "note", width: 40 },
          { header: t.history.colWho, key: "who" },
        ],
        rows: movements.map(m => ({
          date: m.createdAt,
          type: t.history.types[m.type],
          product: m.product.name,
          quantity: m.quantity,
          unit: m.product.unit,
          from: m.fromWarehouse?.name ?? "",
          to: m.toWarehouse?.name ?? "",
          unitCost: m.unitCost === null ? "" : Number(m.unitCost),
          supplier: m.supplier?.name ?? "",
          worker: who(m.worker),
          note: m.note ?? "",
          who: who(m.creator),
        })),
      }
    },
  },

  stock: {
    roles: ["ADMIN", "MANAGER"],
    async build(orgId, _range, t) {
      const products = await prisma.product.findMany({
        where: { organizationId: orgId },
        include: { stockLevels: { include: { warehouse: { select: { name: true } } } } },
        orderBy: { name: "asc" },
      })
      return {
        name: t.exports.sheetStock,
        columns: [
          { header: t.inventory.name, key: "name", width: 30 },
          { header: t.inventory.sku, key: "sku" },
          { header: t.inventory.colType, key: "type" },
          { header: t.inventory.unit, key: "unit", width: 8 },
          { header: t.inventory.colStock, key: "total", kind: "number" },
          { header: t.inventory.warehousesLabel, key: "byWarehouse", width: 40 },
          { header: t.inventory.colCost, key: "cost", kind: "money" },
          { header: t.inventory.colPrice, key: "price", kind: "money" },
          { header: t.reports.inventoryValue, key: "value", kind: "money" },
        ],
        rows: products.map(p => {
          const total = p.stockLevels.reduce((acc, sl) => acc + sl.quantity, 0)
          return {
            name: p.name,
            sku: p.sku ?? "",
            type: p.isRawMaterial ? t.inventory.typeRaw : t.inventory.typeProduct,
            unit: p.unit,
            total,
            byWarehouse: p.stockLevels.map(sl => `${sl.warehouse.name}: ${sl.quantity}`).join("; "),
            cost: Number(p.costPrice),
            price: Number(p.price),
            value: Math.max(total, 0) * Number(p.costPrice),
          }
        }),
      }
    },
  },

  customers: {
    roles: ["ADMIN", "MANAGER"],
    async build(orgId, _range, t) {
      const customers = await prisma.customer.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } })
      return {
        name: t.exports.sheetCustomers,
        columns: [
          { header: t.customers.name, key: "name", width: 30 },
          { header: t.common.phone, key: "phone" },
          { header: t.customers.debt, key: "debt", kind: "money" },
        ],
        rows: customers.map(c => ({ name: c.name, phone: c.phone ?? "", debt: Number(c.debt) })),
      }
    },
  },

  suppliers: {
    roles: ["ADMIN", "MANAGER"],
    async build(orgId, _range, t) {
      const suppliers = await prisma.supplier.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } })
      return {
        name: t.exports.sheetSuppliers,
        columns: [
          { header: t.suppliers.name, key: "name", width: 30 },
          { header: t.common.phone, key: "phone" },
          { header: t.suppliers.ourDebt, key: "debt", kind: "money" },
          { header: t.suppliers.note, key: "note", width: 40 },
        ],
        rows: suppliers.map(s => ({ name: s.name, phone: s.phone ?? "", debt: Number(s.debt), note: s.note ?? "" })),
      }
    },
  },

  expenses: {
    roles: ["ADMIN"],
    async build(orgId, range, t) {
      const createdAt = parseDateRange(range)
      const expenses = await prisma.expense.findMany({
        where: { organizationId: orgId, ...(createdAt ? { createdAt } : {}) },
        include: { createdBy: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: MAX_ROWS,
      })
      return {
        name: t.exports.sheetExpenses,
        columns: [
          { header: t.common.date, key: "date", kind: "datetime" },
          { header: t.finance.category, key: "category" },
          { header: t.finance.amount, key: "amount", kind: "money" },
          { header: t.common.note, key: "note", width: 40 },
          { header: t.common.who, key: "who" },
        ],
        rows: expenses.map(e => ({
          date: e.createdAt,
          category: e.category,
          amount: Number(e.amount),
          note: e.note ?? "",
          who: who(e.createdBy),
        })),
      }
    },
  },

  report: {
    roles: ["ADMIN"],
    async build(_orgId, range, t) {
      const r = await getFinancialSummary(range)
      const R = t.reports
      const metrics: [string, number][] = [
        [R.revenue, r.revenue],
        [R.cogs, r.cogs],
        [R.grossProfit, r.grossProfit],
        [R.expenses, r.totalExpenses],
        [R.adjustments, r.adjustmentsTotal],
        [R.netProfit, r.netProfit],
        [R.accruedWages, r.accruedWages],
        [R.cashIn, r.cashIn],
        [R.purchases, r.purchases],
        [R.supplierPayments, r.supplierPayments],
        [R.inventoryValue, r.inventoryValue],
        [R.customerDebt, r.customerDebt],
        [R.supplierDebt, r.supplierDebt],
      ]
      const period = range.from || range.to ? `${range.from ?? "…"} — ${range.to ?? "…"}` : t.common.allTime
      return {
        name: t.exports.sheetReport,
        columns: [
          { header: t.exports.metric, key: "metric", width: 40 },
          { header: t.exports.value, key: "value", kind: "money", width: 20 },
        ],
        rows: [{ metric: `${t.exports.period}: ${period}`, value: "" }, ...metrics.map(([metric, value]) => ({ metric, value }))],
      }
    },
  },

  workers: {
    roles: ["ADMIN", "MANAGER"],
    async build(_orgId, range, t) {
      const workers = await getWorkerEarnings(range)
      return {
        name: t.exports.sheetWorkers,
        columns: [
          { header: t.workers.employee, key: "name", width: 30 },
          { header: t.workers.loginEmail, key: "email", width: 28 },
          { header: t.workers.pieceWork, key: "piece", kind: "money", width: 22 },
          { header: t.workers.extras, key: "extras", kind: "money", width: 22 },
          { header: t.workers.balance, key: "balance", kind: "money", width: 20 },
        ],
        rows: workers.map(w => ({
          name: w.name ?? "",
          email: w.email,
          piece: w.pieceTotal,
          extras: w.adjustmentTotal,
          balance: w.balance,
        })),
      }
    },
  },
}

export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params
  const t = await getT()
  const builder = BUILDERS[kind]
  if (!builder) return new Response(t.exports.unknownKind, { status: 404 })

  let orgId: string
  try {
    orgId = (await requireRole(...builder.roles)).organizationId
  } catch (err) {
    if (err instanceof ActionError) return new Response(err.message, { status: 403 })
    throw err
  }

  const url = new URL(request.url)
  const range = {
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  }

  const sheet = await builder.build(orgId, range, t)
  const buffer = await buildWorkbook(sheet.name, sheet.columns, sheet.rows)
  const filename = `${kind}-${tashkentDateKey(new Date())}.xlsx`

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
