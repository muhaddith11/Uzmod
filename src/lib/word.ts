import {
  AlignmentType, BorderStyle, Document, Footer, Packer, PageNumber, PageOrientation, Paragraph,
  ShadingType, Table, TableCell, TableLayoutType, TableRow, TabStopType, TextRun, VerticalAlignTable, WidthType,
} from "docx"
import type { Locale } from "@/i18n/locales"
import { formatDotDate, formatMoney, formatNumber } from "@/lib/format"
import { tashkentTimeKey } from "@/lib/tz"

// Rahbarga ko'rsatish uchun Word (.docx) hisobot: sarlavha, asosiy ko'rsatkichlar va jadvallar.
// Sanalar Toshkent vaqtida, sonlar o'zbekcha/ruscha ajratgichlar bilan matnga aylantiriladi —
// Word'da formula yo'q, hujjat qanday yuklansa shunday o'qiladi.

export type ReportColumn = {
  header: string
  key: string
  kind?: "text" | "number" | "money" | "datetime" | "date"
  // Nisbiy kenglik (boshqa ustunlarga nisbatan)
  width?: number
}

export type ReportTable = {
  title?: string
  columns: ReportColumn[]
  rows: Record<string, unknown>[]
  // Oxirgi "Jami" qatori: ustun kaliti → qiymat (birinchi ustunga "Jami" yoziladi)
  totals?: Record<string, unknown>
}

export type ReportStat = { label: string; value: string; tone?: "good" | "bad" }

export type Report = {
  title: string
  period?: string
  summary?: ReportStat[]
  tables: ReportTable[]
}

export type ReportContext = {
  locale: Locale
  orgName: string
  brand: string
  labels: { generated: string; page: string; total: string; empty: string }
}

const FONT = "Calibri"
const C = {
  brand: "4F46E5",
  brandSoft: "EEF2FF",
  ink: "111827",
  muted: "6B7280",
  line: "E5E7EB",
  zebra: "F9FAFB",
  good: "047857",
  bad: "BE123C",
}

// A4, twip (1/20 pt)
const A4 = { width: 11906, height: 16838 }
const MARGIN = 850 // ≈ 1,5 sm
const LANDSCAPE_FROM_COLUMNS = 7

const DEFAULT_WIDTH: Record<NonNullable<ReportColumn["kind"]>, number> = {
  text: 22, number: 11, money: 15, datetime: 15, date: 11,
}

type Border = { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string }
const NONE: Border = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
const HAIRLINE: Border = { style: BorderStyle.SINGLE, size: 4, color: C.line }

// "23.10.2026 14:30" — hujjat bo'ylab bir xil (ICU'ning "23/10/2026, 14:30" ko'rinishi o'rniga)
const dateTime = (value: Date) => `${formatDotDate(value)} ${tashkentTimeKey(value)}`

function formatCell(value: unknown, kind: ReportColumn["kind"], locale: Locale): string {
  if (value === null || value === undefined || value === "") return ""
  switch (kind) {
    case "money": return typeof value === "number" ? formatMoney(value, locale) : String(value)
    case "number": return typeof value === "number" ? formatNumber(value, locale) : String(value)
    case "datetime": return value instanceof Date ? dateTime(value) : String(value)
    case "date": return value instanceof Date || typeof value === "string" ? formatDotDate(value) : String(value)
    default: return String(value)
  }
}

const isNumeric = (kind: ReportColumn["kind"]) => kind === "number" || kind === "money"

function text(value: string, opts: { size?: number; bold?: boolean; color?: string } = {}) {
  return new TextRun({ text: value, font: FONT, size: opts.size ?? 19, bold: opts.bold, color: opts.color ?? C.ink })
}

function cell(
  value: string,
  opts: { width: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; bold?: boolean; color?: string; fill?: string; size?: number; span?: number; bottom?: Border },
) {
  return new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    columnSpan: opts.span,
    verticalAlign: VerticalAlignTable.CENTER,
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    shading: opts.fill ? { type: ShadingType.CLEAR, color: "auto", fill: opts.fill } : undefined,
    borders: { top: NONE, left: NONE, right: NONE, bottom: opts.bottom ?? HAIRLINE },
    children: [new Paragraph({
      alignment: opts.align ?? AlignmentType.LEFT,
      children: [text(value, { bold: opts.bold, color: opts.color, size: opts.size })],
    })],
  })
}

function dataTable(table: ReportTable, contentWidth: number, ctx: ReportContext): Table {
  const weights = table.columns.map(c => c.width ?? DEFAULT_WIDTH[c.kind ?? "text"])
  const sum = weights.reduce((a, b) => a + b, 0)
  const widths = weights.map(w => Math.floor((w / sum) * contentWidth))
  const align = (c: ReportColumn) => (isNumeric(c.kind) ? AlignmentType.RIGHT : AlignmentType.LEFT)

  const header = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: table.columns.map((c, i) => cell(c.header, {
      width: widths[i], align: align(c), bold: true, color: "FFFFFF", fill: C.brand, size: 18, bottom: NONE,
    })),
  })

  const body = table.rows.length > 0
    ? table.rows.map((row, r) => new TableRow({
        cantSplit: true,
        children: table.columns.map((c, i) => cell(formatCell(row[c.key], c.kind, ctx.locale), {
          width: widths[i], align: align(c), fill: r % 2 === 1 ? C.zebra : undefined,
        })),
      }))
    : [new TableRow({
        children: [cell(ctx.labels.empty, { width: contentWidth, span: table.columns.length, align: AlignmentType.CENTER, color: C.muted })],
      })]

  const totals = table.totals && table.rows.length > 0
    ? [new TableRow({
        cantSplit: true,
        children: table.columns.map((c, i) => cell(
          i === 0 ? ctx.labels.total : formatCell(table.totals![c.key], c.kind, ctx.locale),
          { width: widths[i], align: align(c), bold: true, fill: C.brandSoft, bottom: { style: BorderStyle.SINGLE, size: 8, color: C.brand } },
        )),
      })]
    : []

  return new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE },
    rows: [header, ...body, ...totals],
  })
}

/** Asosiy ko'rsatkichlar — qatorda 4 tagacha och fonli katak */
function summaryTable(stats: ReportStat[], contentWidth: number): Table {
  const perRow = Math.min(4, stats.length)
  const gap = 120
  const width = Math.floor((contentWidth - gap * (perRow - 1)) / perRow)
  const rows: TableRow[] = []
  for (let i = 0; i < stats.length; i += perRow) {
    const chunk = stats.slice(i, i + perRow)
    const cells: TableCell[] = []
    chunk.forEach((s, j) => {
      if (j > 0) cells.push(new TableCell({ width: { size: gap, type: WidthType.DXA }, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, children: [new Paragraph({})] }))
      cells.push(new TableCell({
        width: { size: width, type: WidthType.DXA },
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        shading: { type: ShadingType.CLEAR, color: "auto", fill: C.brandSoft },
        borders: { top: NONE, bottom: NONE, right: NONE, left: NONE },
        children: [
          new Paragraph({ children: [text(s.label, { size: 17, color: C.muted })] }),
          new Paragraph({
            spacing: { before: 40 },
            children: [text(s.value, { size: 28, bold: true, color: s.tone === "good" ? C.good : s.tone === "bad" ? C.bad : C.ink })],
          }),
        ],
      }))
    })
    rows.push(new TableRow({ cantSplit: true, children: cells }))
  }
  const columnWidths = Array.from({ length: perRow * 2 - 1 }, (_, k) => (k % 2 === 0 ? width : gap))
  return new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths,
    layout: TableLayoutType.FIXED,
    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: { style: BorderStyle.SINGLE, size: 24, color: "FFFFFF" }, insideVertical: NONE },
    rows,
  })
}

export async function buildReportDocx(report: Report, ctx: ReportContext): Promise<ArrayBuffer> {
  const landscape = report.tables.some(t => t.columns.length >= LANDSCAPE_FROM_COLUMNS)
  const pageWidth = landscape ? A4.height : A4.width
  const contentWidth = pageWidth - MARGIN * 2
  const generatedAt = dateTime(new Date())

  const children: (Paragraph | Table)[] = [
    // Brend va tashkilot — bitta qatorda, ostida brend chizig'i
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.brand, space: 6 } },
      children: [
        text(ctx.brand.toUpperCase(), { size: 32, bold: true, color: C.brand }),
        new TextRun({ text: "\t", font: FONT }),
        text(ctx.orgName, { size: 19, bold: true }),
      ],
    }),
    new Paragraph({
      spacing: { before: 280, after: 60 },
      children: [text(report.title, { size: 36, bold: true })],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [
        ...(report.period ? [text(report.period, { size: 20, color: C.muted }), text("   ·   ", { size: 20, color: C.line })] : []),
        text(`${ctx.labels.generated}: ${generatedAt}`, { size: 20, color: C.muted }),
      ],
    }),
  ]

  if (report.summary && report.summary.length > 0) {
    children.push(summaryTable(report.summary, contentWidth))
  }

  for (const table of report.tables) {
    children.push(new Paragraph({
      spacing: { before: 360, after: 120 },
      keepNext: true,
      children: table.title ? [text(table.title, { size: 24, bold: true })] : [],
    }))
    children.push(dataTable(table, contentWidth, ctx))
  }

  const doc = new Document({
    creator: ctx.brand,
    title: report.title,
    styles: { default: { document: { run: { font: FONT, size: 19, color: C.ink } } } },
    sections: [{
      properties: {
        page: {
          size: { width: A4.width, height: A4.height, orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
            children: [
              text(`${ctx.brand} · ${report.title}`, { size: 16, color: C.muted }),
              new TextRun({ font: FONT, size: 16, color: C.muted, children: ["\t", `${ctx.labels.page} `, PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES] }),
            ],
          })],
        }),
      },
      children,
    }],
  })

  return Packer.toArrayBuffer(doc)
}
