import { findDevice, touchDevice } from "@/lib/device-attendance"
import { textResponse } from "@/lib/zkteco"

// ZKTeco ADMS: qurilma har necha soniyada buyruq so'raydi — aloqa belgisi sifatida saqlanadi
export async function GET(request: Request) {
  const device = await findDevice(new URL(request.url).searchParams.get("SN"))
  if (device) await touchDevice(device.id)
  return textResponse("OK")
}
