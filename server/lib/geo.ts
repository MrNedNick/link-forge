/**
 * Country resolution, honestly limited: behind a CDN the edge already knows and
 * puts it in a header, so we read that. Locally there is no edge, so we fall
 * back to the language the browser asks for — good enough to make the dashboard
 * real, and never presented as more than it is.
 */
const HEADERS = [
  'cf-ipcountry',
  'x-vercel-ip-country',
  'x-nf-client-connection-country',
  'fly-client-country',
  'x-country-code',
]

const REGION_NAMES =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : undefined

export function countryName(code: string | undefined): string {
  if (!code) return 'Unknown'
  const upper = code.toUpperCase()
  if (upper.length !== 2) return 'Unknown'
  try {
    return REGION_NAMES?.of(upper) ?? upper
  } catch {
    return upper
  }
}

export function resolveCountry(headers: Headers): string {
  for (const name of HEADERS) {
    const value = headers.get(name)
    if (value && value !== 'XX') return countryName(value)
  }

  const language = headers.get('accept-language')
  const region = language?.match(/[a-z]{2,3}-([A-Z]{2})/)?.[1]
  return countryName(region)
}
