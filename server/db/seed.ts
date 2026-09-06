import { sql } from 'drizzle-orm'
import { pathToFileURL } from 'node:url'
import { createDatabase, type Database } from './client.js'
import { runMigrations } from './migrate.js'
import { clicks, links, users } from './schema.js'
import { hashPassword } from '../lib/password.js'
import type { NewClick } from './schema.js'

export const DEMO_EMAIL = 'demo@link-forge.dev'
export const DEMO_PASSWORD = 'forge-demo-2026'

const DAYS = 90

/** Seeded PRNG: the demo dashboard looks the same on every machine. */
function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

type Weighted<T> = [T, number][]

function pick<T>(rand: () => number, options: Weighted<T>): T {
  const total = options.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = rand() * total
  for (const [value, weight] of options) {
    roll -= weight
    if (roll <= 0) return value
  }
  return options[0]![0]
}

const SOURCES: Weighted<string> = [
  ['direct', 30],
  ['x.com', 18],
  ['news.ycombinator.com', 14],
  ['google.com', 12],
  ['github.com', 9],
  ['linkedin.com', 7],
  ['reddit.com', 5],
  ['producthunt.com', 3],
  ['buttondown.email', 2],
]

const COUNTRIES: Weighted<string> = [
  ['United States', 26],
  ['Germany', 15],
  ['United Kingdom', 11],
  ['Poland', 9],
  ['Netherlands', 7],
  ['France', 6],
  ['Ukraine', 6],
  ['Canada', 5],
  ['India', 5],
  ['Spain', 4],
  ['Brazil', 3],
  ['Japan', 3],
]

const DEVICES: Weighted<'desktop' | 'mobile' | 'tablet' | 'bot'> = [
  ['desktop', 55],
  ['mobile', 36],
  ['tablet', 5],
  ['bot', 4],
]

const BROWSERS: Record<string, Weighted<string>> = {
  desktop: [['Chrome', 48], ['Safari', 18], ['Firefox', 16], ['Edge', 14], ['Other', 4]],
  mobile: [['Safari', 44], ['Chrome', 44], ['Firefox', 6], ['Other', 6]],
  tablet: [['Safari', 62], ['Chrome', 32], ['Other', 6]],
  bot: [['Bot', 100]],
}

const day = (offset: number) => {
  const now = new Date()
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return new Date(midnight - offset * 86_400_000)
}

const SEED_LINKS = [
  { code: 'docs', url: 'https://hono.dev/docs/', title: 'API documentation', tags: ['product', 'docs'], weight: 26, age: 88 },
  { code: 'orm', url: 'https://orm.drizzle.team/docs/overview', title: 'Drizzle ORM guide', tags: ['docs', 'database'], weight: 14, age: 74 },
  { code: 'pglite', url: 'https://pglite.dev/', title: 'Postgres without a server', tags: ['database', 'research'], weight: 11, age: 61 },
  { code: 'launch', url: 'https://news.ycombinator.com/', title: 'Launch thread', tags: ['launch', 'social'], weight: 22, age: 34, spike: 33 },
  { code: 'repo', url: 'https://github.com/MrNedNick', title: 'Source on GitHub', tags: ['product', 'social'], weight: 12, age: 80 },
  { code: 'changelog', url: 'https://vite.dev/blog', title: 'Release notes', tags: ['product', 'docs'], weight: 9, age: 45 },
  { code: 'webinar', url: 'https://www.youtube.com/', title: 'Recorded walkthrough', tags: ['marketing', 'video'], weight: 8, age: 21, expiresInDays: 12 },
  { code: 'hiring', url: 'https://github.com/MrNedNick?tab=repositories', title: 'Open roles', tags: ['careers'], weight: 5, age: 28 },
  { code: 'a11y', url: 'https://www.w3.org/WAI/WCAG22/quickref/', title: 'Accessibility checklist', tags: ['docs', 'a11y'], weight: 6, age: 52 },
  { code: 'promo-spring', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/410', title: 'Spring promo (ended)', tags: ['marketing'], weight: 4, age: 70, expiresInDays: -6 },
] as const

export async function seed(db: Database, { log = true }: { log?: boolean } = {}) {
  const rand = random(20_260_906)

  // Re-seeding is a reset, not an append: the cascade takes the links and clicks.
  await db.delete(users).where(sql`lower(${users.email}) = ${DEMO_EMAIL}`)

  const [user] = await db
    .insert(users)
    .values({ email: DEMO_EMAIL, passwordHash: await hashPassword(DEMO_PASSWORD) })
    .returning({ id: users.id })
  if (!user) throw new Error('could not create the demo user')

  const created = await db
    .insert(links)
    .values(
      SEED_LINKS.map((link) => ({
        userId: user.id,
        code: link.code,
        url: link.url,
        title: link.title,
        tags: [...link.tags],
        createdAt: day(link.age),
        expiresAt:
          'expiresInDays' in link && typeof link.expiresInDays === 'number'
            ? day(-link.expiresInDays)
            : null,
      })),
    )
    .returning({ id: links.id, code: links.code })

  const byCode = new Map(created.map((row) => [row.code, row.id]))
  // A fixed pool of visitors is what makes "unique visitors" mean anything.
  const visitors = Array.from({ length: 420 }, (_, i) => `seed-visitor-${i.toString(36)}`)

  const rows: NewClick[] = []
  for (const link of SEED_LINKS) {
    const linkId = byCode.get(link.code)
    if (!linkId) continue
    const expiry = 'expiresInDays' in link && typeof link.expiresInDays === 'number' ? link.expiresInDays : undefined

    for (let offset = Math.min(link.age, DAYS - 1); offset >= 0; offset -= 1) {
      // Nothing is clicked before it exists, or after it expired.
      if (expiry !== undefined && expiry < 0 && offset < -expiry) continue

      const date = day(offset)
      const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6
      const growth = 0.55 + (1 - offset / DAYS) * 0.9
      const spike = 'spike' in link && link.spike === offset ? 9 : 1
      const noise = 0.6 + rand() * 0.9
      const expected = link.weight * growth * noise * spike * (weekend ? 0.55 : 1)
      const count = Math.max(0, Math.round(expected))

      for (let i = 0; i < count; i += 1) {
        const device = pick(rand, DEVICES)
        // Working hours in Europe, with a long tail into the US evening.
        const hour = Math.min(23, Math.round(9 + (rand() + rand() + rand() - 1.5) * 6))
        const at = new Date(date.getTime() + hour * 3_600_000 + Math.floor(rand() * 3_600_000))
        if (at.getTime() > Date.now()) continue

        rows.push({
          linkId,
          createdAt: at,
          source: pick(rand, SOURCES),
          country: pick(rand, COUNTRIES),
          device,
          browser: pick(rand, BROWSERS[device]!),
          visitorHash: visitors[Math.floor(rand() * visitors.length)]!,
        })
      }
    }
  }

  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(clicks).values(rows.slice(i, i + 500))
  }

  if (log) {
    console.log(`seeded ${created.length} links and ${rows.length} clicks for ${DEMO_EMAIL}`)
    console.log(`sign in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`)
  }

  return { userId: user.id, links: created.length, clicks: rows.length }
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  const handle = await createDatabase()
  await runMigrations(handle)
  await seed(handle.db)
  await handle.close()
}
