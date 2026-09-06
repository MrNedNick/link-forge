import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createHarness, createLink, signUp, type Harness } from './harness.js'
import { links, users } from '../db/schema.js'
import { createLimiter } from '../routes/links.js'
import { redirectLimiter } from '../routes/redirect.js'

let harness: Harness

beforeEach(async () => {
  harness = await createHarness()
  await signUp(harness, 'edges@example.com')
})

afterEach(async () => {
  await harness.close()
})

describe('shortening the same address twice', () => {
  it('hands back the link that already exists instead of minting a second code', async () => {
    const first = await createLink(harness, { url: 'https://example.com/same', tags: [] })
    const second = await createLink(harness, { url: 'example.com/same', tags: [] })

    expect(first.status).toBe(201)
    expect(second.status).toBe(200)

    const created = await first.json()
    const reused = await second.json()
    expect(reused.link.code).toBe(created.link.code)
    expect(reused.reused).toBe(true)

    const list = await harness.client.request('/api/links')
    expect(((await list.json()) as { items: unknown[] }).items).toHaveLength(1)
  })

  const variants: [Record<string, unknown>, string][] = [
    [{ code: 'on-purpose' }, 'a custom code'],
    [{ title: 'A different campaign' }, 'a label'],
    [{ tags: ['spring'] }, 'tags'],
  ]

  it.each(variants)('still creates a separate link when asked for %j (%s)', async (extra) => {
    await createLink(harness, { url: 'https://example.com/same', tags: [] })
    const second = await createLink(harness, { url: 'https://example.com/same', tags: [], ...extra })

    expect(second.status).toBe(201)
    const list = await harness.client.request('/api/links')
    expect(((await list.json()) as { items: unknown[] }).items).toHaveLength(2)
  })

  it('does not reuse another account`s link', async () => {
    await createLink(harness, { url: 'https://example.com/shared', tags: [] })
    harness.client.forget()
    await signUp(harness, 'second@example.com')

    const mine = await createLink(harness, { url: 'https://example.com/shared', tags: [] })
    expect(mine.status).toBe(201)
  })
})

describe('the redirect endpoint', () => {
  beforeEach(async () => {
    redirectLimiter.reset()
    await createLink(harness, { url: 'https://example.com/target?a=1&b=2', code: 'go', tags: [] })
  })

  it('answers HEAD as well as GET, so link previews resolve', async () => {
    const head = await harness.client.request('/go', { method: 'HEAD' })
    expect(head.status).toBe(302)
    expect(head.headers.get('location')).toBe('https://example.com/target?a=1&b=2')
  })

  it('keeps the query string of the destination intact', async () => {
    const response = await harness.client.request('/go')
    expect(response.headers.get('location')).toBe('https://example.com/target?a=1&b=2')
  })

  it('serves the /r/ alias for hosts that own the root path', async () => {
    expect((await harness.client.request('/r/go')).status).toBe(302)
    expect((await harness.client.request('/r/missing')).status).toBe(404)
  })

  it('escapes whatever is in the path before echoing it on the error page', async () => {
    const response = await harness.client.request('/r/%3Cscript%3Ealert(1)%3C%2Fscript%3E')
    const html = await response.text()
    expect(response.status).toBe(404)
    expect(html).not.toContain('<script>alert(1)')
    expect(html).toContain('&lt;script&gt;')
  })

  it('records nothing for a code that does not resolve', async () => {
    await harness.client.request('/nope-not-here')
    await harness.client.request('/r/also-not-here')
    const overview = await harness.client.request('/api/stats/overview?days=7')
    expect(((await overview.json()) as { totals: { clicks: number } }).totals.clicks).toBe(0)
  })

  it('stops recording once a link expires but keeps the history it already has', async () => {
    await harness.client.request('/go')
    await harness.db
      .update(links)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(links.code, 'go'))

    expect((await harness.client.request('/go')).status).toBe(410)

    const overview = await harness.client.request('/api/stats/overview?days=7')
    expect(((await overview.json()) as { totals: { clicks: number } }).totals.clicks).toBe(1)
  })

  it('sends Retry-After when the redirect limit is reached', async () => {
    let last: Response | undefined
    for (let i = 0; i < 245 && last?.status !== 429; i += 1) {
      last = await harness.client.request('/go')
    }
    expect(last?.status).toBe(429)
    expect(Number(last?.headers.get('retry-after'))).toBeGreaterThan(0)
  })
})

describe('rate limit responses', () => {
  it('puts Retry-After in the headers of an API 429, not only in the body', async () => {
    createLimiter.reset()
    let last: Response | undefined
    for (let i = 0; i < 62 && last?.status !== 429; i += 1) {
      last = await createLink(harness, { url: `https://example.com/${i}`, tags: [] })
    }
    expect(last?.status).toBe(429)
    expect(Number(last?.headers.get('retry-after'))).toBeGreaterThan(0)
  })
})

describe('search and filtering', () => {
  beforeEach(async () => {
    await createLink(harness, { url: 'https://example.com/alpha', code: 'alpha', title: 'Alpha launch', tags: ['launch'] })
    await createLink(harness, { url: 'https://example.com/beta', code: 'beta', title: 'Beta docs', tags: ['docs'] })
    await createLink(harness, { url: 'https://example.com/a_b', code: 'under', title: 'Underscore', tags: [] })
  })

  const items = async (path: string) =>
    ((await (await harness.client.request(path)).json()) as { items: { code: string }[] }).items.map((i) => i.code)

  it('matches code, destination and label', async () => {
    expect(await items('/api/links?query=alpha')).toEqual(['alpha'])
    expect(await items('/api/links?query=docs')).toEqual(['beta'])
    expect(await items('/api/links?query=example.com')).toHaveLength(3)
  })

  it('is case insensitive', async () => {
    expect(await items('/api/links?query=ALPHA')).toEqual(['alpha'])
  })

  it('treats a bare % as text, not as "match everything"', async () => {
    expect(await items('/api/links?query=%25')).toEqual([])
  })

  it('treats _ as a literal underscore', async () => {
    // Without escaping, "a_b" would also match "alpha" style single-character wildcards.
    expect(await items('/api/links?query=a_b')).toEqual(['under'])
  })

  it('filters by an exact tag and lists the tags in use', async () => {
    expect(await items('/api/links?tag=launch')).toEqual(['alpha'])
    expect(await items('/api/links?tag=laun')).toEqual([])

    const response = await harness.client.request('/api/links')
    expect(((await response.json()) as { tags: string[] }).tags).toEqual(['docs', 'launch'])
  })

  it('sorts by code in both directions', async () => {
    expect(await items('/api/links?sort=code&dir=asc')).toEqual(['alpha', 'beta', 'under'])
    expect(await items('/api/links?sort=code&dir=desc')).toEqual(['under', 'beta', 'alpha'])
  })
})

describe('statistics with nothing in them', () => {
  it('answers an account with no links at all without failing', async () => {
    const response = await harness.client.request('/api/stats/overview?days=30')
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      totals: { links: number; clicks: number; visitors: number; trend: number }
      days: unknown[]
      sources: unknown[]
      recent: unknown[]
    }
    expect(body.totals).toEqual({ links: 0, clicks: 0, visitors: 0, trend: 0 })
    expect(body.days).toHaveLength(30)
    expect(body.sources).toEqual([])
    expect(body.recent).toEqual([])
  })

  it('returns exactly one point for a one-day range', async () => {
    const response = await harness.client.request('/api/stats/overview?days=1')
    expect(((await response.json()) as { days: unknown[] }).days).toHaveLength(1)
  })

  it('gives a link with no clicks a full, flat series', async () => {
    const { link } = await (await createLink(harness, { url: 'https://example.com/quiet', tags: [] })).json()
    const response = await harness.client.request(`/api/links/${link.id}/stats?days=7`)
    const body = (await response.json()) as { days: { clicks: number }[]; clicks: number }
    expect(body.clicks).toBe(0)
    expect(body.days).toHaveLength(7)
    expect(body.days.every((day) => day.clicks === 0)).toBe(true)
  })
})

describe('breakdown arithmetic', () => {
  it('adds up to the total, with the tail as its own row', async () => {
    await createLink(harness, { url: 'https://example.com/b', code: 'bd', tags: [] })
    const referrers = ['a.com', 'b.com', 'c.com', 'd.com', 'e.com', 'f.com', 'g.com', 'h.com']
    for (const [index, host] of referrers.entries()) {
      for (let i = 0; i <= index; i += 1) {
        await harness.client.request('/bd', { headers: { referer: `https://${host}/x` } })
      }
    }

    const response = await harness.client.request('/api/stats/overview?days=7')
    const body = (await response.json()) as {
      totals: { clicks: number }
      sources: { label: string; clicks: number; share: number }[]
    }

    expect(body.sources.at(-1)?.label).toBe('Other')
    expect(body.sources.reduce((sum, row) => sum + row.clicks, 0)).toBe(body.totals.clicks)
    expect(body.sources.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(100, 0)
  })
})

describe('sessions at the edges', () => {
  it('rejects a cookie that was never issued', async () => {
    const response = await harness.app.request('/api/links', {
      headers: { cookie: 'lf_session=not-a-real-token' },
    })
    expect(response.status).toBe(401)
  })

  it('drops every session when the account is deleted', async () => {
    expect((await harness.client.request('/api/links')).status).toBe(200)
    await harness.db.delete(users).where(eq(users.email, 'edges@example.com'))
    expect((await harness.client.request('/api/links')).status).toBe(401)
  })

  it('answers the session probe for a signed-out visitor with 200 and no user', async () => {
    harness.client.forget()
    const response = await harness.app.request('/api/auth/me')
    expect(response.status).toBe(200)
    expect((await response.json()) as { user: null }).toEqual({ user: null })
  })
})

describe('unicode survives the round trip', () => {
  it('stores and returns a label and tags in another alphabet', async () => {
    const response = await createLink(harness, {
      url: 'https://example.com/ru',
      title: 'Запуск — весна 2026',
      tags: ['запуск', 'весна'],
    })
    const { link } = await response.json()
    expect(link.title).toBe('Запуск — весна 2026')

    const found = await harness.client.request(`/api/links?query=${encodeURIComponent('Запуск')}`)
    expect(((await found.json()) as { items: unknown[] }).items).toHaveLength(1)
  })
})

describe('the QR endpoint', () => {
  it('returns an SVG that points at the short link', async () => {
    const { link } = await (
      await createLink(harness, { url: 'https://example.com/qr', code: 'qrcode', tags: [] })
    ).json()
    const response = await harness.client.request(`/api/links/${link.id}/qr.svg`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('image/svg+xml')
    const svg = await response.text()
    expect(svg).toContain('<svg')
    expect(svg).toContain('viewBox')
  })
})
