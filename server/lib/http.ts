import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'

export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'invalid'
  | 'rate_limited'
  | 'expired'

/** Every failure leaves the API in the same shape, so the client has one branch. */
export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  extra?: Record<string, unknown>,
) {
  const headers: Record<string, string> = {}
  // A 429 without Retry-After makes every client guess. Send the header too,
  // not just the number in the body.
  if (typeof extra?.retryAfter === 'number') headers['retry-after'] = String(extra.retryAfter)

  return new HTTPException(status as never, {
    res: Response.json({ error: { code, message, ...extra } }, { status, headers }),
  })
}

export function clientIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  return (
    forwarded ||
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-real-ip') ||
    // Node's socket address, present when nothing sits in front of the server.
    (c.env as { incoming?: { socket?: { remoteAddress?: string } } })?.incoming?.socket
      ?.remoteAddress ||
    '127.0.0.1'
  )
}
