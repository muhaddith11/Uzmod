import { findDevice, touchDevice } from "@/lib/device-attendance"
import { textResponse } from "@/lib/zkteco"

// ZKTeco ADMS: ba'zi proshivkalar aloqani shu manzil bilan tekshiradi
export async function GET(request: Request) {
  const device = await findDevice(new URL(request.url).searchParams.get("SN"))
  if (device) await touchDevice(device.id)
  return textResponse("OK")
}
