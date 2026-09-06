import { count, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { clicks, links } from '../db/schema.js'
import { breakdown, recentClicks, startOfDayUtc, timeline } from '../lib/analytics.js'
import { apiError } from '../lib/http.js'
import type { AppEnv } from '../types.js'

export const statsRoutes = new Hono<AppEnv>().get('/overview', async (c) => {
  const user = c.get('user')
  if (!user) throw apiError(401, 'unauthorized', 'Sign in to continue.')

  const db = c.get('db')
  const days = Math.min(Math.max(Number(c.req.query('days') ?? 30), 1), 365)
  const scope = { userId: user.id }
  const owned = db.select({ id: links.id }).from(links).where(eq(links.userId, user.id))

  const [series, sources, countries, devices, recent, linkCount, windowTotals, topLinks] =
    await Promise.all([
      timeline(db, scope, days),
      breakdown(db, 'source', scope, days),
      breakdown(db, 'country', scope, days),
      breakdown(db, 'device', scope, days),
      recentClicks(db, user.id),
      db.select({ value: count() }).from(links).where(eq(links.userId, user.id)),
      db
        .select({
          clicks: sql<number>`count(*)::int`,
          visitors: sql<number>`count(distinct ${clicks.visitorHash})::int`,
        })
        .from(clicks)
        .where(sql`${clicks.linkId} in ${owned} and ${clicks.createdAt} >= ${startOfDayUtc(days - 1)}`),
      db
        .select({
          id: links.id,
          code: links.code,
          url: links.url,
          title: links.title,
          clicks: sql<number>`count(${clicks.id})::int`,
        })
        .from(links)
        .leftJoin(clicks, sql`${clicks.linkId} = ${links.id} and ${clicks.createdAt} >= ${startOfDayUtc(days - 1)}`)
        .where(eq(links.userId, user.id))
        .groupBy(links.id, links.code, links.url, links.title)
        .orderBy(sql`count(${clicks.id}) desc`)
        .limit(5),
    ])

  const previous = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(clicks)
    .where(
      sql`${clicks.linkId} in ${owned}
        and ${clicks.createdAt} >= ${startOfDayUtc(days * 2 - 1)}
        and ${clicks.createdAt} < ${startOfDayUtc(days - 1)}`,
    )

  const current = windowTotals[0]?.clicks ?? 0
  const before = previous[0]?.value ?? 0

  return c.json({
    range: { days, from: series[0]?.date ?? null, to: series.at(-1)?.date ?? null },
    totals: {
      links: linkCount[0]?.value ?? 0,
      clicks: current,
      visitors: windowTotals[0]?.visitors ?? 0,
      /** Percent change against the previous window of the same length. */
      trend: before === 0 ? (current === 0 ? 0 : 100) : Math.round(((current - before) / before) * 100),
    },
    days: series,
    sources,
    countries,
    devices,
    topLinks,
    recent,
  })
})
