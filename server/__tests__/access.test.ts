import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHarness, createLink, signUp, type Harness, type TypedResponse } from './harness.js'
import { authLimiter } from '../routes/auth.js'
import { createLimiter } from '../routes/links.js'

let harness: Harness

beforeEach(async () => {
  harness = await createHarness()
})

afterEach(async () => {
  await harness.close()
})

describe('sessions', () => {
  it('keeps the dashboard closed until someone signs in, and closes it again on sign out', async () => {
    expect((await harness.client.request('/api/links')).status).toBe(401)

    await signUp(harness, 'user@example.com')
    expect((await harness.client.request('/api/links')).status).toBe(200)

    const me = await harness.client.request('/api/auth/me')
    expect(((await me.json()) as { user: { email: string } }).user.email).toBe('user@example.com')

    await harness.client.request('/api/auth/logout', { method: 'POST' })
    expect((await harness.client.request('/api/links')).status).toBe(401)

    // The cookie value is dead server-side, not just dropped by the browser.
    const probe = await harness.app.request('/api/links', { headers: { cookie: harness.client.cookie } })
    expect(probe.status).toBe(401)
  })

  it('gives the same answer for a wrong password and an unknown account', async () => {
    await signUp(harness, 'real@example.com', 'correct-horse-battery')
    harness.client.forget()

    const wrongPassword = await harness.client.json<{ error: { message: string } }>(
      '/api/auth/login',
      'POST',
      { email: 'real@example.com', password: 'wrong-password-here' },
    )
    const unknownUser = await harness.client.json<{ error: { message: string } }>(
      '/api/auth/login',
      'POST',
      { email: 'nobody@example.com', password: 'wrong-password-here' },
    )

    expect(wrongPassword.status).toBe(401)
    expect(unknownUser.status).toBe(401)
    expect((await wrongPassword.json()).error.message).toBe((await unknownUser.json()).error.message)
  })

  it('refuses a second account on the same email', async () => {
    await signUp(harness, 'taken@example.com')
    harness.client.forget()
    const again = await harness.client.json('/api/auth/register', 'POST', {
      email: 'TAKEN@example.com',
      password: 'super-secret-1',
    })
    expect(again.status).toBe(409)
  })
})

describe('ownership', () => {
  it('hides and protects one account`s links from another', async () => {
    await signUp(harness, 'first@example.com')
    const { link } = await (
      await createLink(harness, { url: 'https://example.com/private', code: 'mine', tags: [] })
    ).json()

    harness.client.forget()
    await signUp(harness, 'second@example.com')

    const list = await harness.client.request('/api/links')
    expect(((await list.json()) as { items: unknown[] }).items).toHaveLength(0)

    // Knowing the id is not permission to touch it.
    expect((await harness.client.request(`/api/links/${link.id}`, { method: 'DELETE' })).status).toBe(404)
    expect((await harness.client.request(`/api/links/${link.id}/stats`)).status).toBe(404)
    expect((await harness.client.request(`/api/links/${link.id}/qr.svg`)).status).toBe(404)

    // The short link itself stays public — that is the point of a short link.
    expect((await harness.client.request('/mine')).status).toBe(302)
  })
})

describe('rate limits', () => {
  it('stops a burst of sign-in attempts with a retry hint', async () => {
    authLimiter.reset()
    let last: TypedResponse<{ error: { code: string; retryAfter: number } }> | undefined
    for (let attempt = 0; attempt < 14; attempt += 1) {
      last = await harness.client.json<{ error: { code: string; retryAfter: number } }>('/api/auth/login', 'POST', {
        email: 'someone@example.com',
        password: 'not-the-password',
      })
    }
    expect(last?.status).toBe(429)
    const body = await last!.json()
    expect(body.error.code).toBe('rate_limited')
    expect(body.error.retryAfter).toBeGreaterThan(0)
  })

  it('does not spend the sign-in budget on people who type the right password', async () => {
    authLimiter.reset()
    await signUp(harness, 'regular@example.com', 'correct-horse-battery')

    // Twenty successful sign-ins from one address — a shared office, say — must
    // not lock the next person out.
    for (let i = 0; i < 20; i += 1) {
      harness.client.forget()
      const response = await harness.client.json('/api/auth/login', 'POST', {
        email: 'regular@example.com',
        password: 'correct-horse-battery',
      })
      expect(response.status).toBe(200)
    }
  })

  it('caps how many links one account can mint in an hour', async () => {
    await signUp(harness, 'busy@example.com')
    createLimiter.reset()

    let lastStatus = 201
    for (let i = 0; i < 62 && lastStatus !== 429; i += 1) {
      lastStatus = (await createLink(harness, { url: `https://example.com/${i}`, tags: [] })).status
    }
    expect(lastStatus).toBe(429)
  })
})
