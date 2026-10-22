import { textResponse } from "@/lib/zkteco"

// ZKTeco ADMS: buyruq natijasi. Serverdan buyruq yuborilmaydi — shunchaki qabul qilinadi.
export async function POST() {
  return textResponse("OK")
}
