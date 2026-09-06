const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const plain = new Intl.NumberFormat('en')

export const formatCount = (value: number) => (value < 10_000 ? plain.format(value) : compact.format(value))

export const formatFull = (value: number) => plain.format(value)

const dayLabel = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })

export const formatDay = (iso: string) => dayLabel.format(new Date(`${iso}T00:00:00Z`))

const dateTime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' })

export const formatDateTime = (value: string | Date) => dateTime.format(new Date(value))

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400_000],
  ['month', 30 * 86_400_000],
  ['week', 7 * 86_400_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
]

export function formatRelative(value: string | Date): string {
  const delta = new Date(value).getTime() - Date.now()
  for (const [unit, ms] of UNITS) {
    if (Math.abs(delta) >= ms) return relative.format(Math.round(delta / ms), unit)
  }
  return 'just now'
}

/** Long URLs have to shrink somewhere; the middle carries the least meaning. */
export function shortenUrl(url: string, max = 46): string {
  const trimmed = url.replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (trimmed.length <= max) return trimmed
  const head = trimmed.slice(0, Math.ceil(max * 0.6))
  const tail = trimmed.slice(-Math.floor(max * 0.3))
  return `${head}…${tail}`
}

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
