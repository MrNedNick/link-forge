import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHarness, createLink, signUp, type Harness } from './harness.js'

let harness: Harness

beforeEach(async () => {
  harness = await createHarness()
})

afterEach(async () => {
  await harness.close()
})

const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

describe('the main scenario', () => {
  it('shortens a link, records a click on it, and deletes it', async () => {
    await signUp(harness, 'owner@example.com')

    const created = await createLink(harness, {
      url: 'https://example.com/a/very/long/address',
      code: 'my-link',
      tags: ['launch'],
    })
    expect(created.status).toBe(201)
    const { link } = await created.json()
    expect(link.code).toBe('my-link')

    // Following the short link redirects to the destination...
    const redirect = await harness.client.request('/my-link', {
      headers: { 'user-agent': CHROME, referer: 'https://news.ycombinator.com/item?id=1' },
    })
    expect(redirect.status).toBe(302)
    expect(redirect.headers.get('location')).toBe('https://example.com/a/very/long/address')

    // ...and the click shows up in the dashboard, attributed to its source.
    const overview = await harness.client.request('/api/stats/overview?days=7')
    const stats = (await overview.json()) as {
      totals: { clicks: number; visitors: number; links: number }
      days: { date: string; clicks: number }[]
      sources: { label: string; clicks: number }[]
      recent: { code: string; device: string }[]
    }

    expect(stats.totals).toMatchObject({ links: 1, clicks: 1, visitors: 1 })
    expect(stats.days.at(-1)?.clicks).toBe(1)
    expect(stats.sources[0]).toMatchObject({ label: 'news.ycombinator.com', clicks: 1 })
    expect(stats.recent[0]).toMatchObject({ code: 'my-link', device: 'desktop' })

    // The chart and the totals are the same number, not two different counts.
    expect(stats.days.reduce((sum, day) => sum + day.clicks, 0)).toBe(stats.totals.clicks)

    const list = await harness.client.request('/api/links')
    const { items } = (await list.json()) as { items: { clicks: number; shortUrl: string }[] }
    expect(items[0]?.clicks).toBe(1)
    expect(items[0]?.shortUrl).toMatch(/\/my-link$/)

    const deleted = await harness.client.request(`/api/links/${link.id}`, { method: 'DELETE' })
    expect(deleted.status).toBe(204)

    // Deleting the link takes its history with it, and the code stops resolving.
    expect((await harness.client.request('/my-link')).status).toBe(404)
    const after = await harness.client.request('/api/stats/overview?days=7')
    expect(((await after.json()) as { totals: { clicks: number } }).totals.clicks).toBe(0)
  })
})

describe('link lifetime', () => {
  it('answers 410 for an expired link and 404 for one that never existed', async () => {
    await signUp(harness, 'expiry@example.com')
    const { link } = await (
      await createLink(harness, { url: 'https://example.com', code: 'soon', tags: [] })
    ).json()

    // Expiry in the past is refused on the way in...
    const rejected = await harness.client.json('/api/links', 'POST', {
      url: 'https://example.com',
      code: 'past',
      tags: [],
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    })
    expect(rejected.status).toBe(422)

    // ...so an expired link can only be one whose lifetime ran out since.
    const { links } = await import('../db/schema.js')
    const { eq } = await import('drizzle-orm')
    await harness.db
      .update(links)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(links.id, link.id))

    const gone = await harness.client.request('/soon')
    expect(gone.status).toBe(410)
    expect(await gone.text()).toContain('expired')

    expect((await harness.client.request('/never-existed')).status).toBe(404)
  })
})

describe('custom codes', () => {
  it('refuses a taken code and a reserved one instead of creating a duplicate', async () => {
    await signUp(harness, 'codes@example.com')
    expect((await createLink(harness, { url: 'https://example.com', code: 'promo', tags: [] })).status).toBe(201)

    const duplicate = await createLink(harness, { url: 'https://other.example', code: 'promo', tags: [] })
    expect(duplicate.status).toBe(409)

    const reserved = await createLink(harness, { url: 'https://example.com', code: 'api', tags: [] })
    expect(reserved.status).toBe(409)

    const list = await harness.client.request('/api/links')
    expect(((await list.json()) as { items: unknown[] }).items).toHaveLength(1)
  })

  it('rejects a destination that is not a web address', async () => {
    await signUp(harness, 'validate@example.com')
    const bad = await harness.client.json<{ error: { code: string; message: string; field?: string } }>(
      '/api/links',
      'POST',
      { url: 'javascript:alert(1)', tags: [] },
    )
    expect(bad.status).toBe(422)
    // A rejected field comes back as a sentence plus the field it belongs to,
    // not as a serialised ZodError.
    const { error } = await bad.json()
    expect(error.code).toBe('invalid')
    expect(error.message).toBe('Only http and https links can be shortened.')
    expect(error.field).toBe('url')
  })
})
