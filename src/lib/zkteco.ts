// ZKTeco "ADMS / Push SDK" protokoli: qurilma o'zi serverga /iclock/* manzillari
// orqali ulanadi. Bu yerda — matnli javoblar va davomat qatorlarini o'qish.

export type ParsedPunch = {
  pin: string
  at: Date
  status: number | null
  verify: number | null
}

const LINE_RE = /^(\S+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})(?:\s+(\d+))?(?:\s+(\d+))?/

/**
 * ATTLOG jadvali: har qatorda "PIN\tYYYY-MM-DD HH:MM:SS\tholat\ttasdiqlash\t...".
 * Qurilma vaqti mahalliy (Toshkent, UTC+5) — UTC'ga o'giriladi.
 */
export function parseAttLog(body: string): ParsedPunch[] {
  const punches: ParsedPunch[] = []
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const m = LINE_RE.exec(line)
    if (!m) continue
    const at = new Date(`${m[2]}T${m[3]}+05:00`)
    if (Number.isNaN(at.getTime())) continue
    punches.push({
      pin: m[1],
      at,
      status: m[4] !== undefined ? Number(m[4]) : null,
      verify: m[5] !== undefined ? Number(m[5]) : null,
    })
  }
  return punches
}

/** Birinchi ulanishda qurilmaga beriladigan sozlamalar */
export function handshakeOptions(serialNumber: string): string {
  return [
    `GET OPTION FROM: ${serialNumber}`,
    "ATTLOGStamp=None",
    "OPERLOGStamp=9999",
    "ATTPHOTOStamp=None",
    "ErrorDelay=30",
    "Delay=10",
    "TransTimes=00:00;14:05",
    "TransInterval=1",
    "TransFlag=TransData AttLog",
    "TimeZone=5",
    "Realtime=1",
    "Encrypt=None",
  ].join("\n")
}

export function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  })
}
