import { z } from 'zod'
import { env } from '../env.js'

/** Long enough for any real address; short enough that the column cannot be abused. */
export const MAX_URL_LENGTH = 2048

export type UrlProblem =
  | 'empty'
  | 'too_long'
  | 'unparseable'
  | 'bad_scheme'
  | 'bad_host'
  | 'has_credentials'
  | 'self_reference'

export const URL_MESSAGES: Record<UrlProblem, string> = {
  empty: 'Paste a link first.',
  too_long: `That address is longer than ${MAX_URL_LENGTH} characters.`,
  unparseable: 'That does not look like a web address.',
  bad_scheme: 'Only http and https links can be shortened.',
  bad_host: 'That address needs a real domain name.',
  has_credentials: 'Remove the username and password from the address.',
  self_reference: 'That is already a Link Forge address — shortening it would loop.',
}

/**
 * Normalises a destination before it is ever stored. The value that goes into
 * the database is `URL.href`, not what was typed: the WHATWG parser strips the
 * control characters that would otherwise end up in a `Location:` header, and
 * percent-encodes everything else exactly once.
 */
export function normalizeDestination(
  raw: string,
): { ok: true; url: string } | { ok: false; problem: UrlProblem } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, problem: 'empty' }
  if (trimmed.length > MAX_URL_LENGTH) return { ok: false, problem: 'too_long' }

  // A bare "example.com/x" is what people actually paste, so assume https.
  // "host:8080" looks like a scheme but is not one — a real scheme is either
  // followed by "//" or by something that is not a port number.
  const hasScheme = /^[a-z][a-z0-9+.-]*:(\/\/|(?!\d))/i.test(trimmed)
  const candidate = hasScheme ? trimmed : `https://${trimmed}`

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return { ok: false, problem: 'unparseable' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, problem: 'bad_scheme' }
  }
  if (url.username || url.password) return { ok: false, problem: 'has_credentials' }

  // Checked before the hostname rule: "this is already one of ours" is a more
  // useful answer than "that needs a real domain" when both happen to apply.
  try {
    if (url.origin === new URL(env.publicBaseUrl).origin) {
      return { ok: false, problem: 'self_reference' }
    }
  } catch {
    // A misconfigured PUBLIC_BASE_URL must not make link creation impossible.
  }

  if (!url.hostname.includes('.') || url.hostname.endsWith('.')) {
    return { ok: false, problem: 'bad_host' }
  }

  if (url.href.length > MAX_URL_LENGTH) return { ok: false, problem: 'too_long' }
  return { ok: true, url: url.href }
}

export const destination = z
  .string()
  .max(MAX_URL_LENGTH * 2, URL_MESSAGES.too_long)
  .transform((value, ctx) => {
    const result = normalizeDestination(value)
    if (!result.ok) {
      ctx.addIssue({ code: 'custom', message: URL_MESSAGES[result.problem] })
      return z.NEVER
    }
    return result.url
  })

/** `%` and `_` are ILIKE wildcards; a search box must not be able to smuggle them in. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}
