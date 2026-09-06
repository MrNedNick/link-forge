import { createHash } from 'node:crypto'

export type Device = 'desktop' | 'mobile' | 'tablet' | 'bot'

/**
 * Deliberately small: the dashboard needs four device buckets and a browser
 * name, not a 400 kB user-agent database that goes stale every release.
 */
export function parseUserAgent(userAgent: string | undefined): {
  device: Device
  browser: string
} {
  const ua = userAgent ?? ''
  if (!ua) return { device: 'desktop', browser: 'Unknown' }

  const lower = ua.toLowerCase()
  if (/bot|crawler|spider|crawling|curl|wget|headless|preview|slurp/.test(lower)) {
    return { device: 'bot', browser: 'Bot' }
  }

  const device: Device = /ipad|tablet|playbook|silk/.test(lower)
    ? 'tablet'
    : /mobi|iphone|ipod|android.*mobile|windows phone/.test(lower)
      ? 'mobile'
      : 'desktop'

  const browser = /edg\//.test(lower)
    ? 'Edge'
    : /opr\/|opera/.test(lower)
      ? 'Opera'
      : /firefox\//.test(lower)
        ? 'Firefox'
        : /chrome\/|crios\//.test(lower)
          ? 'Chrome'
          : /safari\//.test(lower)
            ? 'Safari'
            : 'Other'

  return { device, browser }
}

/** Referrer reduced to a host, so the dashboard groups instead of listing URLs. */
export function parseSource(referrer: string | undefined): string {
  if (!referrer) return 'direct'
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '')
    return host || 'direct'
  } catch {
    return 'direct'
  }
}

/**
 * Stable per-visitor identifier that is not personal data: the raw address is
 * hashed with a server salt and never written to a column.
 */
export function visitorHash(ip: string, userAgent: string | undefined, salt: string): string {
  return createHash('sha256').update(`${salt}:${ip}:${userAgent ?? ''}`).digest('hex').slice(0, 32)
}
