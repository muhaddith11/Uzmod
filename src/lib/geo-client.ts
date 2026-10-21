// Brauzerda joylashuvni olish: Telegram Mini App ichida — Telegram LocationManager,
// aks holda — brauzerning geolocation API'si.

export type Coords = { lat: number; lng: number; accuracy: number }

type TelegramLocationData = { latitude: number; longitude: number; horizontal_accuracy?: number | null }
type TelegramLocationManager = {
  isInited: boolean
  isLocationAvailable: boolean
  init: (callback?: () => void) => void
  getLocation: (callback: (data: TelegramLocationData | null) => void) => void
}

function telegramLocationManager(): TelegramLocationManager | null {
  const tg = (window as unknown as { Telegram?: { WebApp?: { LocationManager?: TelegramLocationManager } } }).Telegram
  return tg?.WebApp?.LocationManager ?? null
}

function fromTelegram(lm: TelegramLocationManager): Promise<Coords | null> {
  return new Promise(resolve => {
    const read = () => {
      if (!lm.isLocationAvailable) return resolve(null)
      lm.getLocation(data =>
        resolve(data ? { lat: data.latitude, lng: data.longitude, accuracy: data.horizontal_accuracy ?? 50 } : null)
      )
    }
    if (lm.isInited) read()
    else lm.init(read)
  })
}

function fromBrowser(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("unavailable"))
    navigator.geolocation.getCurrentPosition(
      position => resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      error => reject(error),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  })
}

export async function getCurrentCoords(): Promise<Coords> {
  const lm = telegramLocationManager()
  if (lm) {
    const coords = await fromTelegram(lm).catch(() => null)
    if (coords) return coords
  }
  return fromBrowser()
}
