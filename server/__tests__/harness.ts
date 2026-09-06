import { createApp } from '../app.js'
import { createDatabase } from '../db/client.js'
import { runMigrations } from '../db/migrate.js'
import { authLimiter } from '../routes/auth.js'
import { createLimiter } from '../routes/links.js'
import { redirectLimiter } from '../routes/redirect.js'

export type Harness = Awaited<ReturnType<typeof createHarness>>

/** A Response whose body type is known, so a test does not have to cast it. */
export type TypedResponse<T> = Omit<Response, 'json'> & { json: () => Promise<T> }

/** A whole app on a private in-memory Postgres — no fixtures, no mocked database. */
export async function createHarness() {
  const handle = await createDatabase({ url: '', pgliteDir: ':memory:' })
  await runMigrations(handle)
  const app = createApp({ db: handle.db, quiet: true })

  for (const limiter of [authLimiter, createLimiter, redirectLimiter]) limiter.reset()

  /** Keeps cookies between calls, which is what makes session tests meaningful. */
  const client = (() => {
    let cookie = ''
    return {
      get cookie() {
        return cookie
      },
      async request(path: string, init: RequestInit = {}) {
        const headers = new Headers(init.headers)
        if (cookie) headers.set('cookie', cookie)
        if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
        const response = await app.request(path, { ...init, headers })
        const set = response.headers.get('set-cookie')
        if (set) cookie = set.split(';')[0] ?? cookie
        return response
      },
      json<T>(path: string, method: string, body: unknown): Promise<TypedResponse<T>> {
        return this.request(path, { method, body: JSON.stringify(body) }) as Promise<TypedResponse<T>>
      },
      forget() {
        cookie = ''
      },
    }
  })()

  return { app, db: handle.db, client, close: () => handle.close() }
}

export async function signUp(harness: Harness, email: string, password = 'super-secret-1') {
  const response = await harness.client.json<{ user: { id: string; email: string } }>(
    '/api/auth/register',
    'POST',
    { email, password },
  )
  if (response.status !== 201) throw new Error(`register failed: ${response.status}`)
  return response
}

export type ApiLink = {
  id: string
  code: string
  url: string
  title: string | null
  tags: string[]
  expiresAt: string | null
  createdAt: string
  shortUrl: string
  clicks: number
  visitors: number
  expired: boolean
}

export function createLink(harness: Harness, body: Record<string, unknown>) {
  return harness.client.json<{ link: ApiLink; reused: boolean }>('/api/links', 'POST', body)
}
