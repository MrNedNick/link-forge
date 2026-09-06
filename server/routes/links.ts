import { and, asc, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import QRCode from 'qrcode'
import { z } from 'zod'
import { links, type Link } from '../db/schema.js'
import { breakdown, clickTotals, sparklines, timeline } from '../lib/analytics.js'
import { apiError } from '../lib/http.js'
import { createRateLimiter } from '../lib/rate-limit.js'
import { rangeQuery, resolveDays } from '../lib/range.js'
import { generateCode, isReservedCode, isValidCode } from '../lib/slug.js'
import { destination, escapeLikePattern } from '../lib/url.js'
import { linkId, valid } from '../lib/validation.js'
import { env } from '../env.js'
import type { AppEnv, SessionUser } from '../types.js'

const SPARKLINE_DAYS = 14

/** Tags are a set, not a list: "launch, Launch, launch" is one tag. */
const tagList = z
  .array(z.string().trim().toLowerCase().min(1, 'A tag cannot be blank.').max(24, 'Keep tags under 24 characters.'))
  .max(16, 'Eight tags is the limit.')
  .default([])
  .transform((tags) => [...new Set(tags)])
  .refine((tags) => tags.length <= 8, 'Eight tags is the limit.')

const createBody = z.object({
  url: destination,
  code: z
    .string()
    .trim()
    .max(40, 'A custom code is at most 40 characters.')
    .optional()
    .transform((value) => (value ? value : undefined)),
  title: z.string().trim().max(120, 'Keep the label under 120 characters.').optional(),
  tags: tagList,
  /** ISO date, or null for a link that never expires. */
  expiresAt: z.iso.datetime({ offset: true, message: 'Use an ISO date.' }).nullish(),
})

const updateBody = z
  .object({
    title: z.string().trim().max(120, 'Keep the label under 120 characters.').nullish(),
    tags: tagList.optional(),
    expiresAt: z.iso.datetime({ offset: true, message: 'Use an ISO date.' }).nullish(),
  })
  .refine(
    (body) => Object.values(body).some((value) => value !== undefined),
    'Nothing to change.',
  )

const listQuery = z.object({
  query: z.string().trim().max(120).optional(),
  tag: z.string().trim().toLowerCase().max(24).optional(),
  sort: z.enum(['created', 'clicks', 'code']).default('created'),
  dir: z.enum(['asc', 'desc']).default('desc'),
})

export const createLimiter = createRateLimiter({ limit: 60, windowMs: 60 * 60_000 })

function requireUser(user: SessionUser | undefined): SessionUser {
  if (!user) throw apiError(401, 'unauthorized', 'Sign in to continue.')
  return user
}

const shortUrl = (code: string) => `${env.publicBaseUrl}/${code}`

/** One shape for a link everywhere it leaves the API. */
function present(
  link: Link,
  stats: { clicks?: number; visitors?: number; sparkline?: number[] } = {},
) {
  return {
    ...link,
    shortUrl: shortUrl(link.code),
    clicks: stats.clicks ?? 0,
    visitors: stats.visitors ?? 0,
    sparkline: stats.sparkline ?? [],
    expired: link.expiresAt !== null && link.expiresAt.getTime() <= Date.now(),
  }
}

export const linkRoutes = new Hono<AppEnv>()

  .get('/', valid('query', listQuery), async (c) => {
    const user = requireUser(c.get('user'))
    const db = c.get('db')
    const { query, tag, sort, dir } = c.req.valid('query')

    const filters = [eq(links.userId, user.id)]
    if (query) {
      // Escaped: a bare "%" in the search box must find nothing, not everything.
      const needle = `%${escapeLikePattern(query)}%`
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

    const items = rows.map((row) =>
      present(row, { ...totals.get(row.id), sparkline: series.get(row.id) }),
    )

    if (sort === 'clicks') {
      items.sort((a, b) => (dir === 'asc' ? a.clicks - b.clicks : b.clicks - a.clicks))
    } else if (sort === 'created' && dir === 'asc') {
      items.reverse()
    }

    const tags = [...new Set(rows.flatMap((row) => row.tags))].sort()
    return c.json({ items, tags }, 200)
  })

  .post('/', valid('json', createBody), async (c) => {
    const user = requireUser(c.get('user'))
    const db = c.get('db')
    const body = c.req.valid('json')

    const gate = createLimiter.hit(`create:${user.id}`)
    if (!gate.ok) {
      throw apiError(429, 'rate_limited', `Slow down — ${gate.limit} links an hour is the cap.`, {
        retryAfter: gate.retryAfter,
      })
    }

    if (body.code !== undefined) {
      if (isReservedCode(body.code)) {
        throw apiError(409, 'conflict', 'That code is reserved by the app.', { field: 'code' })
      }
      if (!isValidCode(body.code)) {
        throw apiError(422, 'invalid', 'A custom code is 2–40 letters, digits, dashes or underscores.', {
          field: 'code',
        })
      }
    }

    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw apiError(422, 'invalid', 'The expiry date is already in the past.', { field: 'expiresAt' })
    }

    // Shortening the same address twice with no other instructions is almost
    // always a repeated paste, so hand back the link that already exists rather
    // than minting a second code for the same destination.
    const plain = !body.code && !body.title && body.tags.length === 0 && !expiresAt
    if (plain) {
      const [existing] = await db
        .select()
        .from(links)
        .where(and(eq(links.userId, user.id), eq(links.url, body.url), isNull(links.expiresAt)))
        .orderBy(desc(links.createdAt))
        .limit(1)

      if (existing) {
        const totals = await clickTotals(db, [existing.id])
        return c.json({ link: present(existing, totals.get(existing.id)), reused: true }, 200)
      }
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

      if (created) return c.json({ link: present(created), reused: false }, 201)
      if (body.code) {
        throw apiError(409, 'conflict', `“${body.code}” is already taken.`, { field: 'code' })
      }
    }

    throw apiError(500, 'invalid', 'Could not find a free code. Try again.')
  })

  .patch('/:id', valid('json', updateBody), async (c) => {
    const user = requireUser(c.get('user'))
    const db = c.get('db')
    const body = c.req.valid('json')

    const expiresAt = body.expiresAt === undefined ? undefined : body.expiresAt ? new Date(body.expiresAt) : null
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw apiError(422, 'invalid', 'The expiry date is already in the past.', { field: 'expiresAt' })
    }

    const [updated] = await db
      .update(links)
      .set({
        ...(body.title !== undefined ? { title: body.title || null } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
        ...(expiresAt !== undefined ? { expiresAt } : {}),
      })
      .where(and(eq(links.id, linkId(c)), eq(links.userId, user.id)))
      .returning()

    if (!updated) throw apiError(404, 'not_found', 'That link is gone.')

    const totals = await clickTotals(db, [updated.id])
    const series = await sparklines(db, [updated.id], SPARKLINE_DAYS)
    return c.json(
      { link: present(updated, { ...totals.get(updated.id), sparkline: series.get(updated.id) }) },
      200,
    )
  })

  .delete('/:id', async (c) => {
    const user = requireUser(c.get('user'))
    // Ownership is part of the WHERE clause, so someone else's id simply matches nothing.
    const [deleted] = await c
      .get('db')
      .delete(links)
      .where(and(eq(links.id, linkId(c)), eq(links.userId, user.id)))
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
      .where(and(eq(links.id, linkId(c)), eq(links.userId, user.id)))
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

  .get('/:id/stats', valid('query', rangeQuery), async (c) => {
    const user = requireUser(c.get('user'))
    const db = c.get('db')
    const days = resolveDays(c.req.valid('query').days)

    const [link] = await db
      .select()
      .from(links)
      .where(and(eq(links.id, linkId(c)), eq(links.userId, user.id)))
      .limit(1)
    if (!link) throw apiError(404, 'not_found', 'That link is gone.')

    const scope = { userId: user.id, linkId: link.id }
    const [series, sources, countries, devices, totals] = await Promise.all([
      timeline(db, scope, days),
      breakdown(db, 'source', scope, days),
      breakdown(db, 'country', scope, days),
      breakdown(db, 'device', scope, days),
      clickTotals(db, [link.id]),
    ])

    return c.json(
      {
        link: present(link, totals.get(link.id)),
        days: series,
        sources,
        countries,
        devices,
        clicks: totals.get(link.id)?.clicks ?? 0,
        visitors: totals.get(link.id)?.visitors ?? 0,
      },
      200,
    )
  })
