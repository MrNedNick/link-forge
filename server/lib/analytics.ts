import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import type { Database } from '../db/client.js'
import { clicks, links } from '../db/schema.js'

export type DayPoint = { date: string; clicks: number; visitors: number }
export type Breakdown = { label: string; clicks: number; share: number }

const dayExpr = sql<string>`to_char(date_trunc('day', ${clicks.createdAt} at time zone 'UTC'), 'YYYY-MM-DD')`

export function startOfDayUtc(daysAgo: number): Date {
  const now = new Date()
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return new Date(start - daysAgo * 86_400_000)
}

export function dateKeys(days: number): string[] {
  const keys: string[] = []
  for (let i = days - 1; i >= 0; i -= 1) keys.push(startOfDayUtc(i).toISOString().slice(0, 10))
  return keys
}

/** Days with no clicks still have to appear, or the chart lies about the shape. */
function fillDays(days: number, rows: { date: string; clicks: number; visitors: number }[]): DayPoint[] {
  const byDate = new Map(rows.map((row) => [row.date, row]))
  return dateKeys(days).map(
    (date) => byDate.get(date) ?? { date, clicks: 0, visitors: 0 },
  )
}

/**
 * Shares are computed against every click in the window, not against the six
 * rows that fit on screen, and the remainder is shown as its own row — so the
 * column adds up to 100% instead of quietly inflating the leader.
 */
function toBreakdown(rows: { label: string; clicks: number }[], total: number): Breakdown[] {
  const share = (clicks: number) => (total === 0 ? 0 : Math.round((clicks / total) * 1000) / 10)
  const listed = rows.reduce((sum, row) => sum + row.clicks, 0)
  const result = rows.map((row) => ({ ...row, share: share(row.clicks) }))
  if (total > listed) result.push({ label: 'Other', clicks: total - listed, share: share(total - listed) })
  return result
}

const ownedLinkIds = (db: Database, userId: string) =>
  db.select({ id: links.id }).from(links).where(eq(links.userId, userId))

/** Keyed by link id; the field names match what the API returns, on purpose. */
export async function clickTotals(db: Database, linkIds: string[]) {
  if (linkIds.length === 0) return new Map<string, { clicks: number; visitors: number }>()
  const rows = await db
    .select({
      linkId: clicks.linkId,
      clicks: sql<number>`count(*)::int`,
      visitors: sql<number>`count(distinct ${clicks.visitorHash})::int`,
    })
    .from(clicks)
    .where(inArray(clicks.linkId, linkIds))
    .groupBy(clicks.linkId)
  return new Map(rows.map((row) => [row.linkId, { clicks: row.clicks, visitors: row.visitors }]))
}

/** Per-link daily counts for the row sparklines — one query for the whole table. */
export async function sparklines(db: Database, linkIds: string[], days: number) {
  const keys = dateKeys(days)
  const empty = () => keys.map(() => 0)
  if (linkIds.length === 0) return new Map<string, number[]>()

  const rows = await db
    .select({ linkId: clicks.linkId, date: dayExpr, clicks: sql<number>`count(*)::int` })
    .from(clicks)
    .where(and(inArray(clicks.linkId, linkIds), gte(clicks.createdAt, startOfDayUtc(days - 1))))
    .groupBy(clicks.linkId, dayExpr)

  const index = new Map(keys.map((key, i) => [key, i]))
  const series = new Map<string, number[]>(linkIds.map((id) => [id, empty()]))
  for (const row of rows) {
    const bucket = series.get(row.linkId)
    const i = index.get(row.date)
    if (bucket && i !== undefined) bucket[i] = row.clicks
  }
  return series
}

export async function timeline(
  db: Database,
  where: { userId: string; linkId?: string },
  days: number,
): Promise<DayPoint[]> {
  const scope = where.linkId
    ? eq(clicks.linkId, where.linkId)
    : inArray(clicks.linkId, ownedLinkIds(db, where.userId))

  const rows = await db
    .select({
      date: dayExpr,
      clicks: sql<number>`count(*)::int`,
      visitors: sql<number>`count(distinct ${clicks.visitorHash})::int`,
    })
    .from(clicks)
    .where(and(scope, gte(clicks.createdAt, startOfDayUtc(days - 1))))
    .groupBy(dayExpr)
    .orderBy(dayExpr)

  return fillDays(days, rows)
}

export async function breakdown(
  db: Database,
  column: 'source' | 'country' | 'device' | 'browser',
  where: { userId: string; linkId?: string },
  days: number,
  limit = 6,
): Promise<Breakdown[]> {
  const scope = where.linkId
    ? eq(clicks.linkId, where.linkId)
    : inArray(clicks.linkId, ownedLinkIds(db, where.userId))
  const target = clicks[column]

  const window = and(scope, gte(clicks.createdAt, startOfDayUtc(days - 1)))

  const [rows, totals] = await Promise.all([
    db
      .select({ label: target, clicks: sql<number>`count(*)::int` })
      .from(clicks)
      .where(window)
      .groupBy(target)
      .orderBy(desc(sql`count(*)`))
      .limit(limit),
    db.select({ value: sql<number>`count(*)::int` }).from(clicks).where(window),
  ])

  return toBreakdown(rows, totals[0]?.value ?? 0)
}

export async function recentClicks(db: Database, userId: string, limit = 8) {
  return db
    .select({
      id: clicks.id,
      code: links.code,
      url: links.url,
      createdAt: clicks.createdAt,
      source: clicks.source,
      country: clicks.country,
      device: clicks.device,
      browser: clicks.browser,
    })
    .from(clicks)
    .innerJoin(links, eq(links.id, clicks.linkId))
    .where(eq(links.userId, userId))
    .orderBy(desc(clicks.createdAt))
    .limit(limit)
}
