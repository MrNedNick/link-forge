import { describe, expect, it } from 'vitest'
import { ApiError, errorMessage, unwrap } from '../api/client'

const response = (status: number, body: unknown, ok = status < 400) =>
  ({
    ok,
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError('Unexpected end of JSON input')
      return body
    },
  }) as never

describe('unwrap', () => {
  it('returns the payload of a successful response', async () => {
    await expect(unwrap(response(200, { items: [1] }))).resolves.toEqual({ items: [1] })
  })

  it('treats 204 as success without touching the missing body', async () => {
    await expect(unwrap(response(204, undefined))).resolves.toBeUndefined()
  })

  it('turns an API error into an ApiError carrying its code', async () => {
    const failing = unwrap(response(409, { error: { code: 'conflict', message: '“x” is already taken.' } }))
    await expect(failing).rejects.toBeInstanceOf(ApiError)
    await expect(failing).rejects.toMatchObject({ code: 'conflict', status: 409 })
  })

  it('carries the retry hint from a 429', async () => {
    const failing = unwrap(
      response(429, { error: { code: 'rate_limited', message: 'Slow down.', retryAfter: 42 } }),
    )
    await expect(failing).rejects.toMatchObject({ retryAfter: 42 })
  })

  it('reads the first issue when a validator answers instead of the route', async () => {
    const failing = unwrap(
      response(400, { error: { issues: [{ message: 'Use at least 8 characters.' }] } }),
    )
    await expect(failing).rejects.toThrow('Use at least 8 characters.')
  })

  it('still fails cleanly when the error body cannot be read at all', async () => {
    const failing = unwrap(response(500, undefined, false))
    await expect(failing).rejects.toThrow('Something went wrong.')
  })

  it('says something useful for an unauthorised response with no body', async () => {
    const failing = unwrap(response(401, undefined, false))
    await expect(failing).rejects.toThrow('Sign in to continue.')
  })
})

describe('errorMessage', () => {
  it('explains a network failure in words a person can act on', () => {
    expect(errorMessage(new TypeError('Failed to fetch'))).toContain('Cannot reach the server')
  })

  it('passes an ApiError message through unchanged', () => {
    expect(errorMessage(new ApiError(404, { code: 'not_found', message: 'That link is gone.' }))).toBe(
      'That link is gone.',
    )
  })

  it('falls back to a sentence for anything else', () => {
    expect(errorMessage(null)).toBe('Something went wrong.')
  })
})
