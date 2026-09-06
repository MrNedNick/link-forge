import { zValidator } from '@hono/zod-validator'
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import QRCode from 'qrcode'
import { z } from 'zod'
import { links } from '../db/schema.js'
import { breakdown, clickTotals, sparklines, timeline } from '../lib/analytics.js'
import { apiError } from '../lib/http.js'
import { createRateLimiter } from '../lib/rate-limit.js'
import { generateCode, isReservedCode, isValidCode } from '../lib/slug.js'
import { env } from '../env.js'
import type { AppEnv, SessionUser } from '../types.js'

const SPARKLINE_DAYS = 14

const httpUrl = z
  .string()
  .trim()
  .min(1, 'Paste a link first.')
  .transform((value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`))
  .refine((value) => {
    try {
      const url = new URL(value)
      return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.')
    } catch {
      return false
    }
  }, 'That does not look like a web address.')

const createBody = z.object({
  url: httpUrl,
  code: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((value) => (value ? value : undefined)),
  title: z.string().trim().max(120).optional(),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(24)).max(8).default([]),
  /** ISO date, or null for a link that never expires. */
  expiresAt: z.iso.datetime({ offset: true }).nullish(),
})

const updateBody = createBody.partial().omit({ url: true, code: true })

const listQuery = z.object({
  query: z.string().trim().max(120).optional(),
  tag: z.string().trim().toLowerCase().max(24).optional(),
  sort: z.enum(['created', 'clicks', 'code']).default('created'),
  dir: z.enum(['asc', 'desc']).default('desc'),
})

const creations = createRateLimiter({ limit: 60, windowMs: 60 * 60_000 })

function requireUser(user: SessionUser | undefined): SessionUser {
  if (!user) throw apiError(401, 'unauthorized', 'Sign in to continue.')
  return user
}

const shortUrl = (code: string) => `${env.publicBaseUrl}/${code}`

export const linkRoutes = new Hono<AppEnv>()

  .get('/', zValidator('query', listQuery), async (c) => {
    const user = requireUser(c.get('user'))
    const db = c.get('db')
    const { query, tag, sort, dir } = c.req.valid('query')

    const filters = [eq(links.userId, user.id)]
    if (query) {
      const needle = `%${query}%`
      const match = or(ilike(links.code, needle), ilike(links.url, needle), ilike(links.title, needle))
      if (match) filters.push(match)
    }
    if (tag) filters.push(sql`${links.tags} @> ARRAY[${tag}]::text[]`)

    const rows = await db
      .select()
      .from(links)
      .where(and(...filters))
      .orderBy(sort === 'code' ? (dir === 'asc' ? asc(links.code) : desc(links.code)) : desc(links.createdAt))

    const ids = rows.map((row) => row.id)
    const [totals, series] = await Promise.all([
      clickTotals(db, ids),
      sparklines(db, ids, SPARKLINE_DAYS),
    ])

    const items = rows.map((row) => ({
      ...row,
      shortUrl: shortUrl(row.code),
      clicks: totals.get(row.id)?.total ?? 0,
      visitors: totals.get(row.id)?.visitors ?? 0,
      sparkline: series.get(row.id) ?? [],
      expired: row.expiresAt !== null && row.expiresAt.getTime() <= Date.now(),
    }))

    if (sort === 'clicks') {
      items.sort((a, b) => (dir === 'asc' ? a.clicks - b.clicks : b.clicks - a.clicks))
    } else if (sort === 'created' && dir === 'asc') {
      items.reverse()
    }

    const tags = [...new Set(rows.flatMap((row) => row.tags))].sort()
    return c.json({ items, tags })
  })

  .post('/', zValidator('json', createBody), async (c) => {
    const user = requireUser(c.get('user'))
    const db = c.get('db')
    const body = c.req.valid('json')

    const gate = creations.check(`create:${user.id}`)
    if (!gate.ok) {
      throw apiError(429, 'rate_limited', `Slow down — ${gate.limit} links an hour is the cap.`, {
        retryAfter: gate.retryAfter,
      })
    }

    if (body.code !== undefined) {
      if (isReservedCode(body.code)) throw apiError(409, 'conflict', 'That code is reserved by the app.')
      if (!isValidCode(body.code)) {
        throw apiError(422, 'invalid', 'A custom code is 2–40 letters, digits, dashes or underscores.')
      }
    }

    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw apiError(422, 'invalid', 'The expiry date is already in the past.')
    }

    // A custom code is taken or it is not; a generated one retries on collision.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = body.code ?? generateCode()
      const [created] = await db
        .insert(links)
        .values({
          userId: user.id,
          code,
          url: body.url,
          title: body.title || null,
          tags: body.tags,
          expiresAt,
        })
        .onConflictDoNothing({ target: links.code })
        .returning()

      if (created) {
        return c.json(
          { link: { ...created, shortUrl: shortUrl(created.code), clicks: 0, visitors: 0, sparkline: [], expired: false } },
          201,
        )
      }
      if (body.code) throw apiError(409, 'conflict', `“${body.code}” is already taken.`)
    }

    throw apiError(500, 'invalid', 'Could not find a free code. Try again.')
  })

  .patch('/:id', zValidator('json', updateBody), async (c) => {
    const user = requireUser(c.get('user'))
    const db = c.get('db')
    const body = c.req.valid('json')

    const [updated] = await db
      .update(links)
      .set({
        ...(body.title !== undefined ? { title: body.title || null } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
        ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null } : {}),
      })
      .where(and(eq(links.id, c.req.param('id')), eq(links.userId, user.id)))
      .returning()

    if (!updated) throw apiError(404, 'not_found', 'That link is gone.')
    return c.json({ link: { ...updated, shortUrl: shortUrl(updated.code) } })
  })

  .delete('/:id', async (c) => {
    const user = requireUser(c.get('user'))
    // Ownership is part of the WHERE clause, so someone else's id simply matches nothing.
    const [deleted] = await c
      .get('db')
      .delete(links)
      .where(and(eq(links.id, c.req.param('id')), eq(links.userId, user.id)))
      .returning({ id: links.id })

    if (!deleted) throw apiError(404, 'not_found', 'That link is gone.')
    return c.body(null, 204)
  })

  .get('/:id/qr.svg', async (c) => {
    const user = requireUser(c.get('user'))
    const [link] = await c
      .get('db')
      .select()
      .from(links)
      .where(and(eq(links.id, c.req.param('id')), eq(links.userId, user.id)))
      .limit(1)

    if (!link) throw apiError(404, 'not_found', 'That link is gone.')

    const svg = await QRCode.toString(shortUrl(link.code), {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#14171c', light: '#0000' },
    })
    return c.body(svg, 200, {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'private, max-age=300',
    })
  })

  .get('/:id/stats', async (c) => {
    const user = requireUser(c.get('user'))
    const db = c.get('db')
    const days = Math.min(Math.max(Number(c.req.query('days') ?? 30), 1), 365)

    const [link] = await db
      .select()
      .from(links)
      .where(and(eq(links.id, c.req.param('id')), eq(links.userId, user.id)))
      .limit(1)
    if (!link) throw apiError(404, 'not_found', 'That link is gone.')

    const scope = { userId: user.id, linkId: link.id }
    const [days_, sources, countries, devices, totals] = await Promise.all([
      timeline(db, scope, days),
      breakdown(db, 'source', scope, days),
      breakdown(db, 'country', scope, days),
      breakdown(db, 'device', scope, days),
      clickTotals(db, [link.id]),
    ])

    return c.json({
      link: { ...link, shortUrl: shortUrl(link.code) },
      days: days_,
      sources,
      countries,
      devices,
      clicks: totals.get(link.id)?.total ?? 0,
      visitors: totals.get(link.id)?.visitors ?? 0,
    })
  })
