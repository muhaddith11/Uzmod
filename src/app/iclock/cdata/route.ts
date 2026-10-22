import { findDevice, processPunches, touchDevice } from "@/lib/device-attendance"
import { handshakeOptions, parseAttLog, textResponse } from "@/lib/zkteco"

// ZKTeco ADMS: qurilma shu manzilga ulanadi. Sessiya yo'q — qurilma seriya raqami
// (SN) Sozlamalarda ro'yxatdan o'tkazilgan bo'lishi shart, aks holda ma'lumot olinmaydi.

export async function GET(request: Request) {
  const url = new URL(request.url)
  const device = await findDevice(url.searchParams.get("SN"))
  if (!device) return textResponse("OK")
  await touchDevice(device.id)
  return textResponse(handshakeOptions(device.serialNumber))
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  const device = await findDevice(url.searchParams.get("SN"))
  const body = await request.text()
  if (!device) return textResponse("OK")
  await touchDevice(device.id)

  // Faqat davomat jadvali qayta ishlanadi; boshqalari (OPERLOG, rasm) qabul qilinib o'tkaziladi
  if ((url.searchParams.get("table") ?? "").toUpperCase() !== "ATTLOG") {
    return textResponse("OK")
  }
  const punches = parseAttLog(body)
  const accepted = await processPunches(device, punches)
  return textResponse(`OK: ${accepted}`)
}
