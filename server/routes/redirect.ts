import { eq } from 'drizzle-orm'
import type { Context } from 'hono'
import { clicks, links } from '../db/schema.js'
import { env } from '../env.js'
import { resolveCountry } from '../lib/geo.js'
import { clientIp } from '../lib/http.js'
import { noticePage } from '../lib/page.js'
import { createRateLimiter } from '../lib/rate-limit.js'
import { parseSource, parseUserAgent, visitorHash } from '../lib/ua.js'
import type { AppEnv } from '../types.js'

// A redirect is cheap for us and cheap to abuse, so the ceiling is high but real.
const redirects = createRateLimiter({ limit: 240, windowMs: 60_000 })

export async function handleRedirect(c: Context<AppEnv>, code: string): Promise<Response> {
  const gate = redirects.check(`redirect:${clientIp(c)}`)
  if (!gate.ok) {
    return new Response('Too many requests', {
      status: 429,
      headers: { 'retry-after': String(gate.retryAfter), 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  const db = c.get('db')
  const [link] = await db.select().from(links).where(eq(links.code, code)).limit(1)

  if (!link) {
    return noticePage({
      status: 404,
      title: 'No such link',
      message: 'This short link has never existed, or it was deleted by its owner.',
      code,
      home: env.publicBaseUrl,
    })
  }

  if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
    return noticePage({
      status: 410,
      title: 'This link has expired',
      message: 'Its owner gave it a lifetime and that lifetime is over.',
      code,
      home: env.publicBaseUrl,
    })
  }

  const headers = new Headers()
  for (const [key, value] of Object.entries(c.req.header())) headers.set(key, value)
  const userAgent = c.req.header('user-agent')
  const { device, browser } = parseUserAgent(userAgent)

  // The visitor waits for the redirect, not for the write.
  const record = db.insert(clicks).values({
    linkId: link.id,
    source: parseSource(c.req.header('referer') ?? c.req.header('referrer')),
    country: resolveCountry(headers),
    device,
    browser,
    visitorHash: visitorHash(clientIp(c), userAgent, env.visitorSalt),
  })

  if (env.isTest) await record
  else void record.catch((error: unknown) => console.error('click not recorded', error))

  return c.redirect(link.url, 302)
}

export { redirects as redirectLimiter }
