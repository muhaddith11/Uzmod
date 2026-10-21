import ExcelJS from "exceljs"

export type ExcelColumn = {
  header: string
  key: string
  width?: number
  kind?: "text" | "number" | "money" | "datetime"
}

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000

/**
 * Bitta varaqli .xlsx fayl. Sanalar Toshkent vaqtida yoziladi (Excel'da vaqt
 * zonasi yo'q — UTC yozilsa 5 soat farq qilib ko'rinardi).
 */
export async function buildWorkbook(
  sheetName: string,
  columns: ExcelColumn[],
  rows: Record<string, unknown>[],
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Uzmod"
  workbook.created = new Date()

  // Excel varaq nomi 31 belgidan oshmasin va ba'zi belgilarsiz bo'lsin
  const sheet = workbook.addWorksheet(sheetName.replace(/[\\/?*[\]:]/g, " ").slice(0, 31))
  sheet.columns = columns.map(c => ({
    header: c.header,
    key: c.key,
    width: c.width ?? (c.kind === "datetime" ? 18 : c.kind === "text" || !c.kind ? 24 : 14),
    style:
      c.kind === "money" ? { numFmt: "#,##0" }
      : c.kind === "number" ? { numFmt: "#,##0.###" }
      : c.kind === "datetime" ? { numFmt: "dd.mm.yyyy hh:mm" }
      : {},
  }))

  for (const row of rows) {
    const values: Record<string, unknown> = {}
    for (const c of columns) {
      const value = row[c.key]
      values[c.key] = value instanceof Date ? new Date(value.getTime() + TASHKENT_OFFSET_MS) : value ?? ""
    }
    sheet.addRow(values)
  }

  const header = sheet.getRow(1)
  header.font = { bold: true }
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } }
  sheet.views = [{ state: "frozen", ySplit: 1 }]
  if (rows.length > 0) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return buffer as ArrayBuffer
}
