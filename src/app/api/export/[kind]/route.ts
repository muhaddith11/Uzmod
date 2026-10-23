import { prisma } from "@/lib/prisma"
import { ActionError } from "@/lib/action"
import { requireRole, type Role } from "@/lib/session"
import { buildReportDocx, type Report } from "@/lib/word"
import { parseDateRange, tashkentDateKey, tashkentTimeKey, type DateRangeParams } from "@/lib/tz"
import { getFinancialSummary } from "@/lib/actions/reports"
import { getWorkerEarnings } from "@/lib/actions/workers"
import { getStockOverview } from "@/lib/actions/batches"
import { getYarnStock } from "@/lib/actions/yarn"
import { getStockSales } from "@/lib/actions/stock-sales"
import { getFinanceSummary } from "@/lib/actions/finance"
import { getTodayBoard } from "@/lib/actions/attendance"
import { boardStateLabel, buildTimesheet, resolveRange } from "@/lib/attendance"
import { formatDuration } from "@/lib/domain/attendance"
import { formatDotDate, formatMoney, formatNumber, personName } from "@/lib/format"
import { getLocale, getT } from "@/i18n/server"
import type { Locale } from "@/i18n/locales"
import type { Messages } from "@/i18n/messages"

// /api proxy'dan o'tmaydi — sessiya va rol har bir eksportda shu yerda tekshiriladi.
// Har bir hisobot sahifada ko'rinadigan ma'lumotni Word (.docx) hujjatga yig'adi.

type Ctx = { orgId: string; range: DateRangeParams; t: Messages; locale: Locale }
type Builder = { roles: Role[]; file: string; build: (ctx: Ctx) => Promise<Report> }

const MAX_ROWS = 20_000

const who = (u: { name: string | null; email: string | null } | null) => (u ? personName(u) : "")

function periodText(range: { from?: string; to?: string }, t: Messages): string {
  if (!range.from && !range.to) return `${t.exports.period}: ${t.common.allTime}`
  const day = (key?: string) => (key ? formatDotDate(key) : "…")
  return `${t.exports.period}: ${day(range.from)} — ${day(range.to)}`
}

const sum = <T,>(rows: T[], pick: (row: T) => number) => rows.reduce((acc, r) => acc + pick(r), 0)

const BUILDERS: Record<string, Builder> = {
  // Ombor: ip, tayyor paypoq, brak va otxot; partiyalar
  stock: {
    roles: ["ADMIN", "MANAGER"],
    file: "ombor",
    async build({ t, locale }) {
      const [overview, yarn] = await Promise.all([getStockOverview(), getYarnStock()])
      const S = t.stock
      const Y = t.yarn
      const kg = (n: number) => `${formatNumber(n, locale)} kg`
      return {
        title: t.exports.titleStock,
        period: formatDotDate(new Date()),
        summary: [
          { label: S.yarnTotal, value: kg(overview.yarnKg) },
          { label: `${S.finishedTotal} (${S.approxSocks(formatNumber(overview.finishedSocks, locale))})`, value: kg(overview.finishedKg) },
          { label: S.defectTotal, value: kg(overview.defectKg) },
          { label: S.wasteTotal, value: kg(overview.wasteKg) },
        ],
        tables: [
          {
            title: S.yarnTitle,
            columns: [
              { header: Y.type, key: "type", width: 20 },
              { header: Y.color, key: "color", width: 18 },
              { header: `${Y.colStock} (kg)`, key: "stock", kind: "number" },
              { header: `${Y.colToday} (kg)`, key: "today", kind: "number" },
              { header: `${Y.colKnitting} (kg)`, key: "knitting", kind: "number" },
            ],
            rows: yarn
              .filter(y => y.stockKg !== 0 || y.todayKg > 0 || y.knittingKg > 0)
              .map(y => ({ type: y.yarnType, color: y.color, stock: y.stockKg, today: y.todayKg, knitting: y.knittingKg })),
            totals: { stock: overview.yarnKg },
          },
          {
            title: S.batchesTitle,
            columns: [
              { header: S.colBatch, key: "batch", width: 30 },
              { header: S.colFinished, key: "finished", kind: "number" },
              { header: S.colSocks, key: "socks", kind: "number" },
              { header: S.colDefect, key: "defect", kind: "number" },
              { header: S.colWaste, key: "waste", kind: "number" },
              { header: S.colProduced, key: "produced", kind: "number", width: 13 },
            ],
            rows: overview.batches.map(b => ({
              batch: b.label, finished: b.finishedKg, socks: b.finishedSocks, defect: b.defectKg, waste: b.wasteKg, produced: b.producedKg,
            })),
            totals: {
              finished: sum(overview.batches, b => b.finishedKg),
              socks: sum(overview.batches, b => b.finishedSocks),
              defect: sum(overview.batches, b => b.defectKg),
              waste: sum(overview.batches, b => b.wasteKg),
              produced: sum(overview.batches, b => b.producedKg),
            },
          },
        ],
      }
    },
  },

  // Ombordan sotuv (kg bo'yicha, nasiya bilan)
  sales: {
    roles: ["ADMIN", "MANAGER"],
    file: "sotuvlar",
    async build({ range, t, locale }) {
      const period = resolveRange(range)
      const { rows, totals } = await getStockSales(period)
      const S = t.stockSales
      return {
        title: t.exports.titleSales,
        period: periodText(period, t),
        summary: [
          { label: S.soldKg, value: `${formatNumber(totals.kg, locale)} kg` },
          { label: S.revenue, value: formatMoney(totals.total, locale) },
          { label: S.received, value: formatMoney(totals.paid, locale), tone: "good" },
          { label: S.onCredit, value: formatMoney(totals.debt, locale), tone: totals.debt > 0 ? "bad" : undefined },
        ],
        tables: [{
          columns: [
            { header: t.common.date, key: "date", kind: "datetime" },
            { header: S.colItem, key: "item", width: 30 },
            { header: S.colKg, key: "kg", kind: "number", width: 9 },
            { header: S.colTotal, key: "total", kind: "money" },
            { header: S.colPaid, key: "paid", kind: "money" },
            { header: S.colDebt, key: "debt", kind: "money" },
            { header: S.colCustomer, key: "customer", width: 18 },
          ],
          rows: rows.map(s => ({
            date: s.createdAt,
            item: s.kind === "WASTE" ? s.label : `${S.kinds[s.kind]}: ${s.label}`,
            kg: s.kg,
            total: s.total,
            paid: s.paid,
            debt: s.debt,
            customer: s.customerName ?? "",
          })),
          totals: { kg: totals.kg, total: totals.total, paid: totals.paid, debt: totals.debt },
        }],
      }
    },
  },

  // Moliya: sotuv, kassa, xarajatlar va qarzdorlar
  finance: {
    roles: ["ADMIN"],
    file: "moliya",
    async build({ range, t, locale }) {
      const period = resolveRange(range)
      const data = await getFinanceSummary(period)
      const F = t.finance
      const money = (n: number) => formatMoney(n, locale)
      return {
        title: t.exports.titleFinance,
        period: periodText(period, t),
        summary: [
          { label: F.salesTotal, value: money(data.salesTotal) },
          { label: F.cashIn, value: money(data.cashIn), tone: "good" },
          { label: F.expensesTotal, value: money(data.expensesTotal), tone: "bad" },
          { label: F.balance, value: money(data.balance), tone: data.balance < 0 ? "bad" : undefined },
          { label: F.totalDebt, value: money(data.totalDebt) },
        ],
        tables: [
          {
            title: t.exports.tableByCategory,
            columns: [
              { header: F.category, key: "category", width: 30 },
              { header: F.amount, key: "amount", kind: "money", width: 20 },
            ],
            rows: data.byCategory.map(c => ({ category: F.categoryLabels[c.category] ?? c.category, amount: c.amount })),
            totals: { amount: data.expensesTotal },
          },
          {
            title: t.exports.tableExpenses,
            columns: [
              { header: t.common.date, key: "date", kind: "datetime" },
              { header: F.category, key: "category", width: 16 },
              { header: F.employee, key: "employee", width: 18 },
              { header: F.amount, key: "amount", kind: "money" },
              { header: t.common.note, key: "note", width: 24 },
            ],
            rows: data.expenses.map(e => ({
              date: e.createdAt,
              category: F.categoryLabels[e.category] ?? e.category,
              employee: e.employeeName ?? "",
              amount: e.amount,
              note: e.note ?? "",
            })),
            totals: { amount: data.expensesTotal },
          },
          {
            title: F.debtorsTitle,
            columns: [
              { header: t.stockSales.colCustomer, key: "name", width: 30 },
              { header: t.common.phone, key: "phone", width: 18 },
              { header: t.customers.debt, key: "debt", kind: "money", width: 18 },
            ],
            rows: data.debtors.map(c => ({ name: c.name, phone: c.phone ?? "", debt: c.debt })),
            totals: { debt: data.totalDebt },
          },
        ],
      }
    },
  },

  // Xodimlar: davomat xulosasi va hisob (ishbay + bonus/jarima)
  workers: {
    roles: ["ADMIN", "MANAGER"],
    file: "xodimlar",
    async build({ orgId, range, t, locale }) {
      const period = resolveRange(range)
      const [workers, timesheet] = await Promise.all([getWorkerEarnings(period), buildTimesheet(orgId, period)])
      const byUser = new Map(timesheet.map(r => [r.userId, r.summary]))
      const W = t.workers
      const A = t.attendance
      const rows = workers.map(w => {
        const s = byUser.get(w.id)
        return {
          name: w.isActive ? personName(w) : `${personName(w)} (${t.common.blocked.toLowerCase()})`,
          present: s ? `${s.presentDays} / ${s.workingDays}` : "",
          hours: s ? formatDuration(s.workedMinutes) : "",
          late: s?.lateCount ?? "",
          absent: s?.absentDays ?? "",
          piece: w.pieceTotal,
          extras: w.adjustmentTotal,
          balance: w.balance,
        }
      })
      const total = sum(workers, w => w.balance)
      return {
        title: t.exports.titleWorkers,
        period: periodText(period, t),
        summary: [
          { label: t.exports.workersCount, value: String(workers.filter(w => w.isActive).length) },
          { label: W.pieceWork, value: formatMoney(sum(workers, w => w.pieceTotal), locale) },
          { label: W.extras, value: formatMoney(sum(workers, w => w.adjustmentTotal), locale) },
          { label: W.balance, value: formatMoney(total, locale) },
        ],
        tables: [{
          columns: [
            { header: W.employee, key: "name", width: 24 },
            { header: A.colPresent, key: "present", width: 10 },
            { header: A.colHours, key: "hours", width: 10 },
            { header: A.colLateCount, key: "late", kind: "number", width: 9 },
            { header: A.colAbsent, key: "absent", kind: "number", width: 9 },
            { header: W.pieceWork, key: "piece", kind: "money" },
            { header: W.extras, key: "extras", kind: "money" },
            { header: W.balance, key: "balance", kind: "money" },
          ],
          rows,
          totals: { piece: sum(workers, w => w.pieceTotal), extras: sum(workers, w => w.adjustmentTotal), balance: total },
        }],
      }
    },
  },

  // Bugungi davomat
  attendance: {
    roles: ["ADMIN", "MANAGER"],
    file: "davomat",
    async build({ t }) {
      const board = await getTodayBoard()
      const A = t.attendance
      const time = (d: Date | null) => (d ? tashkentTimeKey(d) : "")
      return {
        title: `${t.exports.titleAttendance} — ${formatDotDate(board.date)}`,
        summary: [
          { label: A.countInWork, value: `${board.counts.inWork} / ${board.counts.total}`, tone: "good" },
          { label: A.countLate, value: String(board.counts.late) },
          { label: A.countAbsent, value: String(board.counts.absent), tone: board.counts.absent > 0 ? "bad" : undefined },
          { label: A.countExcused, value: String(board.counts.excused) },
        ],
        tables: [{
          columns: [
            { header: A.colEmployee, key: "name", width: 26 },
            { header: A.colStatus, key: "status", width: 16 },
            { header: A.colIn, key: "in", width: 9 },
            { header: A.colOut, key: "out", width: 9 },
            { header: A.colWorked, key: "worked", width: 11 },
            { header: A.colLate, key: "late", width: 11 },
          ],
          rows: board.rows.map(r => ({
            name: r.name,
            status: boardStateLabel(t, r.state),
            in: time(r.checkIn),
            out: time(r.checkOut),
            worked: r.checkIn ? formatDuration(r.workedMinutes) : "",
            late: r.lateMinutes > 0 ? A.minutes(r.lateMinutes) : "",
          })),
        }],
      }
    },
  },

  // Quyidagilar — eski umumiy ombor tizimi sahifalari (yashirin bo'limlar)
  productSales: {
    roles: ["ADMIN", "MANAGER"],
    file: "mahsulot-sotuvi",
    async build({ orgId, range, t }) {
      const createdAt = parseDateRange(range)
      const sales = await prisma.sale.findMany({
        where: { organizationId: orgId, ...(createdAt ? { createdAt } : {}) },
        include: {
          customer: { select: { name: true } },
          createdBy: { select: { name: true, email: true } },
          items: { include: { product: { select: { name: true, unit: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: MAX_ROWS,
      })
      return {
        title: t.exports.titleProductSales,
        period: periodText(range, t),
        tables: [{
          columns: [
            { header: t.common.date, key: "date", kind: "datetime" },
            { header: t.common.customer, key: "customer" },
            { header: t.sales.colItems, key: "items", width: 40 },
            { header: t.sales.colTotal, key: "total", kind: "money" },
            { header: t.sales.colPaid, key: "paid", kind: "money" },
            { header: t.sales.colPayment, key: "payment", width: 12 },
            { header: t.sales.colStatus, key: "status", width: 14 },
            { header: t.sales.by, key: "by", width: 14 },
          ],
          rows: sales.map(s => ({
            date: s.createdAt,
            customer: s.customer?.name ?? "",
            items: s.items.map(i => `${i.product.name} × ${i.quantity} ${i.product.unit}`).join("; "),
            total: Number(s.totalAmount),
            paid: Number(s.paidAmount),
            payment: t.sales.payment[s.paymentType],
            status: s.status === "ACTIVE" ? t.sales.statusActive : `${t.sales.statusCancelled}: ${s.cancelReason ?? ""}`,
            by: who(s.createdBy),
          })),
        }],
      }
    },
  },

  movements: {
    roles: ["ADMIN", "MANAGER"],
    file: "harakatlar",
    async build({ orgId, range, t }) {
      const createdAt = parseDateRange(range)
      const movements = await prisma.stockMovement.findMany({
        where: { organizationId: orgId, ...(createdAt ? { createdAt } : {}) },
        include: {
          product: { select: { name: true, unit: true } },
          creator: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: MAX_ROWS,
      })
      return {
        title: t.exports.titleMovements,
        period: periodText(range, t),
        tables: [{
          columns: [
            { header: t.common.date, key: "date", kind: "datetime" },
            { header: t.history.colType, key: "type", width: 14 },
            { header: t.history.colProduct, key: "product", width: 24 },
            { header: t.history.colQty, key: "quantity", kind: "number" },
            { header: t.inventory.unit, key: "unit", width: 8 },
            { header: t.history.colNote, key: "note", width: 26 },
            { header: t.history.colWho, key: "who", width: 14 },
          ],
          rows: movements.map(m => ({
            date: m.createdAt,
            type: t.history.types[m.type],
            product: m.product.name,
            quantity: m.quantity,
            unit: m.product.unit,
            note: m.note ?? "",
            who: who(m.creator),
          })),
        }],
      }
    },
  },

  products: {
    roles: ["ADMIN", "MANAGER"],
    file: "mahsulotlar",
    async build({ orgId, t }) {
      const products = await prisma.product.findMany({
        where: { organizationId: orgId },
        include: { stockLevels: { select: { quantity: true } } },
        orderBy: { name: "asc" },
      })
      return {
        title: t.exports.titleProducts,
        tables: [{
          columns: [
            { header: t.inventory.name, key: "name", width: 30 },
            { header: t.inventory.colType, key: "type", width: 14 },
            { header: t.inventory.unit, key: "unit", width: 8 },
            { header: t.inventory.colStock, key: "total", kind: "number" },
            { header: t.inventory.colCost, key: "cost", kind: "money" },
            { header: t.reports.inventoryValue, key: "value", kind: "money" },
          ],
          rows: products.map(p => {
            const total = p.stockLevels.reduce((acc, sl) => acc + sl.quantity, 0)
            return {
              name: p.name,
              type: p.isRawMaterial ? t.inventory.typeRaw : t.inventory.typeProduct,
              unit: p.unit,
              total,
              cost: Number(p.costPrice),
              value: Math.max(total, 0) * Number(p.costPrice),
            }
          }),
        }],
      }
    },
  },

  customers: {
    roles: ["ADMIN", "MANAGER"],
    file: "mijozlar",
    async build({ orgId, t }) {
      const customers = await prisma.customer.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } })
      return {
        title: t.exports.titleCustomers,
        tables: [{
          columns: [
            { header: t.customers.name, key: "name", width: 30 },
            { header: t.common.phone, key: "phone", width: 18 },
            { header: t.customers.debt, key: "debt", kind: "money", width: 18 },
          ],
          rows: customers.map(c => ({ name: c.name, phone: c.phone ?? "", debt: Number(c.debt) })),
          totals: { debt: sum(customers, c => Number(c.debt)) },
        }],
      }
    },
  },

  suppliers: {
    roles: ["ADMIN", "MANAGER"],
    file: "taminotchilar",
    async build({ orgId, t }) {
      const suppliers = await prisma.supplier.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } })
      return {
        title: t.exports.titleSuppliers,
        tables: [{
          columns: [
            { header: t.suppliers.name, key: "name", width: 26 },
            { header: t.common.phone, key: "phone", width: 16 },
            { header: t.suppliers.ourDebt, key: "debt", kind: "money", width: 16 },
            { header: t.suppliers.note, key: "note", width: 26 },
          ],
          rows: suppliers.map(s => ({ name: s.name, phone: s.phone ?? "", debt: Number(s.debt), note: s.note ?? "" })),
          totals: { debt: sum(suppliers, s => Number(s.debt)) },
        }],
      }
    },
  },

  report: {
    roles: ["ADMIN"],
    file: "hisobot",
    async build({ range, t }) {
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
      return {
        title: t.exports.titleReport,
        period: periodText(range, t),
        tables: [{
          columns: [
            { header: t.exports.metric, key: "metric", width: 40 },
            { header: t.exports.value, key: "value", kind: "money", width: 20 },
          ],
          rows: metrics.map(([metric, value]) => ({ metric, value })),
        }],
      }
    },
  },
}

export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params
  const [t, locale] = await Promise.all([getT(), getLocale()])
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

  const [report, org] = await Promise.all([
    builder.build({ orgId, range, t, locale }),
    prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { name: true } }),
  ])
  const file = await buildReportDocx(report, {
    locale,
    orgName: org.name,
    brand: t.common.appName,
    labels: { generated: t.exports.generated, page: t.exports.page, total: t.common.total, empty: t.common.noData },
  })
  const filename = `${builder.file}-${tashkentDateKey(new Date())}.docx`

  return new Response(file, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
