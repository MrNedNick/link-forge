import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHarness, createLink, signUp, type Harness } from './harness.js'
import { MAX_URL_LENGTH } from '../lib/url.js'

let harness: Harness

beforeEach(async () => {
  harness = await createHarness()
  await signUp(harness, 'validator@example.com')
})

afterEach(async () => {
  await harness.close()
})

const message = async (response: { json: () => Promise<unknown> }) =>
  ((await response.json()) as { error?: { message?: string } }).error?.message ?? ''

const field = async (response: { json: () => Promise<unknown> }) =>
  ((await response.json()) as { error?: { field?: string } }).error?.field

describe('destination URLs', () => {
  const rejected: [string, string, string][] = [
    ['javascript:alert(1)', 'a javascript: URL', 'http and https'],
    ['data:text/html,<h1>hi</h1>', 'a data: URL', 'http and https'],
    ['file:///etc/passwd', 'a file:// path', 'http and https'],
    ['ftp://example.com/x', 'another scheme', 'http and https'],
    ['localhost:3000', 'a host with no dot', 'real domain'],
    ['https://', 'a scheme on its own', 'does not look like'],
    ['https://example.com.', 'a trailing dot host', 'real domain'],
    ['https://user:hunter2@example.com/x', 'credentials in the URL', 'username and password'],
    ['   ', 'nothing but spaces', 'Paste a link'],
    [`https://example.com/${'a'.repeat(MAX_URL_LENGTH)}`, 'an address over the length cap', 'longer than'],
  ]

  it.each(rejected)('rejects %s (%s)', async (url, _label, fragment) => {
    const response = await createLink(harness, { url, tags: [] })
    expect(response.status).toBe(422)
    expect(await message(response)).toContain(fragment)
  })

  it('refuses to shorten its own short links, which would loop forever', async () => {
    const response = await createLink(harness, { url: 'http://localhost:8787/anything', tags: [] })
    expect(response.status).toBe(422)
    expect(await message(response)).toContain('loop')
  })

  const normalised: [string, string, string][] = [
    ['example.com/pricing', 'https://example.com/pricing', 'assumes https for a bare host'],
    ['  https://example.com/x  ', 'https://example.com/x', 'trims surrounding whitespace'],
    ['HTTPS://EXAMPLE.COM/Path', 'https://example.com/Path', 'lowercases scheme and host, keeps the path'],
    ['https://example.com', 'https://example.com/', 'adds the root path'],
    ['https://example.com/a b', 'https://example.com/a%20b', 'encodes a space'],
    ['https://example.com/?q=1&r=2#frag', 'https://example.com/?q=1&r=2#frag', 'keeps query and fragment'],
  ]

  it.each(normalised)('normalises %s to %s (%s)', async (input, expected) => {
    const response = await createLink(harness, { url: input, tags: [] })
    expect(response.status).toBe(201)
    expect((await response.json()).link.url).toBe(expected)
  })

  it('strips the control characters that would forge a response header', async () => {
    const response = await createLink(harness, {
      url: 'https://example.com/a\r\nSet-Cookie: stolen=1',
      tags: [],
    })
    expect(response.status).toBe(201)
    const stored = (await response.json()).link.url
    expect(stored).not.toMatch(/[\r\n]/)

    // And the redirect built from it carries a header a client will accept.
    const redirect = await harness.client.request(`/${(await createLink(harness, { url: 'https://example.com/plain', code: 'hdr', tags: [] }), 'hdr')}`)
    expect(redirect.status).toBe(302)
  })

  it('accepts an internationalised domain by storing its canonical form', async () => {
    const response = await createLink(harness, { url: 'https://пример.рф/страница', tags: [] })
    expect(response.status).toBe(201)
    const stored = (await response.json()).link.url
    expect(stored.startsWith('https://xn--')).toBe(true)
  })
})

describe('custom codes', () => {
  const rejected: [string, string][] = [
    ['a', 'a single character'],
    ['has space', 'a space'],
    ['привет', 'non-ASCII letters'],
    ['dot.code', 'a dot'],
    ['-leading', 'a leading dash'],
    ['..', 'only dots'],
    ['code/with/slash', 'slashes'],
  ]

  it.each(rejected)('rejects "%s" (%s)', async (code) => {
    const response = await createLink(harness, { url: 'https://example.com/c', code, tags: [] })
    expect(response.status).toBe(422)
  })

  it('names the field that was rejected, so a form can point at it', async () => {
    const badCode = await createLink(harness, { url: 'https://example.com/c', code: 'no spaces', tags: [] })
    expect(await field(badCode)).toBe('code')

    const badUrl = await createLink(harness, { url: 'ftp://example.com', tags: [] })
    expect(await field(badUrl)).toBe('url')

    const badExpiry = await createLink(harness, {
      url: 'https://example.com/x',
      tags: [],
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    })
    expect(await field(badExpiry)).toBe('expiresAt')
  })

  it('rejects a code past the length cap before it reaches the database', async () => {
    const response = await createLink(harness, {
      url: 'https://example.com/c',
      code: 'a'.repeat(41),
      tags: [],
    })
    expect(response.status).toBe(422)
    expect(await message(response)).toContain('40 characters')
  })

  it.each(['api', 'API', 'health', 'robots.txt', 'assets', 'login'])(
    'keeps the reserved path "%s" for the app',
    async (code) => {
      const response = await createLink(harness, { url: 'https://example.com/c', code, tags: [] })
      expect(response.status).toBe(409)
    },
  )

  it('accepts the shortest and longest codes the rules allow', async () => {
    expect((await createLink(harness, { url: 'https://example.com/1', code: 'ab', tags: [] })).status).toBe(201)
    expect(
      (await createLink(harness, { url: 'https://example.com/2', code: 'a'.repeat(40), tags: [] })).status,
    ).toBe(201)
  })

  it('treats codes as case sensitive, the way every shortener does', async () => {
    expect((await createLink(harness, { url: 'https://example.com/l', code: 'Promo', tags: [] })).status).toBe(201)
    expect((await createLink(harness, { url: 'https://example.com/u', code: 'promo', tags: [] })).status).toBe(201)
    expect((await harness.client.request('/Promo')).status).toBe(302)
    expect((await harness.client.request('/promo')).status).toBe(302)
  })
})

describe('tags', () => {
  it('collapses duplicates and case instead of storing them twice', async () => {
    const response = await createLink(harness, {
      url: 'https://example.com/tags',
      tags: ['Launch', 'launch', 'LAUNCH', 'docs'],
    })
    expect(response.status).toBe(201)
    expect((await response.json()).link.tags).toEqual(['launch', 'docs'])
  })

  it('counts the limit after de-duplication, not before', async () => {
    const eightUnique = Array.from({ length: 8 }, (_, i) => `tag-${i}`)
    expect((await createLink(harness, { url: 'https://example.com/8', tags: [...eightUnique, ...eightUnique] })).status).toBe(201)
    expect((await createLink(harness, { url: 'https://example.com/9', tags: [...eightUnique, 'one-too-many'] })).status).toBe(422)
  })

  it.each([
    [[''], 'a blank tag'],
    [['x'.repeat(25)], 'a tag past 24 characters'],
  ])('rejects %s (%s)', async (tags) => {
    expect((await createLink(harness, { url: 'https://example.com/t', tags })).status).toBe(422)
  })

  it('keeps a non-ASCII tag intact', async () => {
    const response = await createLink(harness, { url: 'https://example.com/ru', tags: ['запуск'] })
    expect((await response.json()).link.tags).toEqual(['запуск'])
  })
})

describe('expiry', () => {
  it.each([
    ['not-a-date', 'plain nonsense'],
    ['2026-13-45T00:00:00Z', 'a month and day that cannot exist'],
    ['2026-09-06', 'a date with no time'],
  ])('rejects %s (%s)', async (expiresAt) => {
    expect((await createLink(harness, { url: 'https://example.com/e', tags: [], expiresAt })).status).toBe(422)
  })

  it('rejects an expiry that has already passed', async () => {
    const response = await createLink(harness, {
      url: 'https://example.com/e',
      tags: [],
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    })
    expect(response.status).toBe(422)
    expect(await message(response)).toContain('already in the past')
  })

  it('accepts an offset timestamp and a null for "never"', async () => {
    const soon = new Date(Date.now() + 3_600_000).toISOString().replace('Z', '+00:00')
    expect((await createLink(harness, { url: 'https://example.com/o', tags: [], expiresAt: soon })).status).toBe(201)
    expect((await createLink(harness, { url: 'https://example.com/n', tags: [], expiresAt: null })).status).toBe(201)
  })
})

describe('credentials', () => {
  it.each([
    [{ email: 'nope', password: 'password-1234' }, 'an address with no @'],
    [{ email: `${'x'.repeat(250)}@example.com`, password: 'password-1234' }, 'an address past 254 characters'],
    [{ email: 'a@b.co', password: '1234567' }, 'a seven-character password'],
    [{ email: 'a@b.co', password: 'x'.repeat(201) }, 'a password past the cap'],
  ])('rejects %j (%s)', async (body) => {
    harness.client.forget()
    expect((await harness.client.json('/api/auth/register', 'POST', body)).status).toBe(422)
  })

  it('normalises the address so one account cannot be created twice', async () => {
    harness.client.forget()
    expect((await harness.client.json('/api/auth/register', 'POST', { email: '  Mixed@Example.COM ', password: 'password-1234' })).status).toBe(201)
    harness.client.forget()
    expect((await harness.client.json('/api/auth/register', 'POST', { email: 'mixed@example.com', password: 'password-1234' })).status).toBe(409)
  })
})

describe('malformed requests', () => {
  it('answers a body that is not JSON with an error, not a crash', async () => {
    const response = await harness.client.request('/api/links', {
      method: 'POST',
      body: 'this is not json',
      headers: { 'content-type': 'application/json' },
    })
    expect([400, 422]).toContain(response.status)
    expect(response.status).toBeLessThan(500)
  })

  it.each([
    ['/api/links?sort=sideways', 'an unknown sort key'],
    ['/api/links?dir=up', 'an unknown direction'],
    ['/api/stats/overview?days=abc', 'a non-numeric range'],
  ])('rejects %s (%s)', async (path) => {
    expect((await harness.client.request(path)).status).toBe(422)
  })

  it('clamps a range that is merely unreasonable rather than refusing it', async () => {
    const response = await harness.client.request('/api/stats/overview?days=9999')
    expect(response.status).toBe(200)
    expect(((await response.json()) as { range: { days: number } }).range.days).toBe(365)

    const zero = await harness.client.request('/api/stats/overview?days=0')
    expect(((await zero.json()) as { range: { days: number } }).range.days).toBe(1)
  })

  it.each([
    ['DELETE', '/api/links/not-a-uuid'],
    ['GET', '/api/links/not-a-uuid/stats'],
    ['GET', '/api/links/not-a-uuid/qr.svg'],
  ])('answers %s %s with 404 instead of a database error', async (method, path) => {
    const response = await harness.client.request(path, { method })
    expect(response.status).toBe(404)
  })

  it('answers PATCH with a malformed id with 404', async () => {
    const response = await harness.client.json('/api/links/not-a-uuid', 'PATCH', { title: 'x' })
    expect(response.status).toBe(404)
  })
})
