import { eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { valid } from '../lib/validation.js'
import { sessions, users } from '../db/schema.js'
import { apiError, clientIp } from '../lib/http.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { createRateLimiter } from '../lib/rate-limit.js'
import {
  clearSessionCookie,
  createSession,
  destroySession,
  sessionToken,
  setSessionCookie,
} from '../lib/session.js'
import type { AppEnv } from '../types.js'

const credentials = z.object({
  // 254 is the longest address SMTP will carry; without a cap the column is an
  // open invitation to store a megabyte of nothing.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, 'That email address is too long.')
    .pipe(z.email('Enter a valid email address.')),
  password: z
    .string()
    .min(8, 'Use at least 8 characters for the password.')
    .max(200, 'Keep the password under 200 characters.'),
})

// Brute force is the only real threat to a password form. Only failed attempts
// are counted, so signing in successfully never spends anyone else's budget on
// a shared address — and a burst of wrong passwords still hits the wall.
const attempts = createRateLimiter({ limit: 12, windowMs: 15 * 60_000 })

const tooManyAttempts = (retryAfter: number) =>
  apiError(429, 'rate_limited', 'Too many attempts. Try again shortly.', { retryAfter })

export const authRoutes = new Hono<AppEnv>()

  .post('/register', valid('json', credentials), async (c) => {
    const ip = clientIp(c)
    const gate = attempts.peek(`auth:${ip}`)
    if (!gate.ok) throw tooManyAttempts(gate.retryAfter)

    const { email, password } = c.req.valid('json')
    const db = c.get('db')

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1)
    if (existing) {
      attempts.hit(`auth:${ip}`)
      throw apiError(409, 'conflict', 'That email already has an account.')
    }

    const [user] = await db
      .insert(users)
      .values({ email, passwordHash: await hashPassword(password) })
      .returning({ id: users.id, email: users.email, createdAt: users.createdAt })
    if (!user) throw apiError(500, 'invalid', 'Could not create the account.')

    const session = await createSession(db, user.id, c.req.header('user-agent'))
    setSessionCookie(c, session.token, session.expiresAt)
    return c.json({ user }, 201)
  })

  .post('/login', valid('json', credentials), async (c) => {
    const ip = clientIp(c)
    const gate = attempts.peek(`auth:${ip}`)
    if (!gate.ok) throw tooManyAttempts(gate.retryAfter)

    const { email, password } = c.req.valid('json')
    const db = c.get('db')

    const [user] = await db
      .select({ id: users.id, email: users.email, passwordHash: users.passwordHash, createdAt: users.createdAt })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1)

    // Same message either way: a different one turns the form into an account oracle.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      attempts.hit(`auth:${ip}`)
      throw apiError(401, 'unauthorized', 'Email or password is wrong.')
    }

    const session = await createSession(db, user.id, c.req.header('user-agent'))
    setSessionCookie(c, session.token, session.expiresAt)
    return c.json({ user: { id: user.id, email: user.email, createdAt: user.createdAt } }, 200)
  })

  .post('/logout', async (c) => {
    await destroySession(c.get('db'), sessionToken(c))
    clearSessionCookie(c)
    return c.body(null, 204)
  })

  // A session probe, not a protected resource: "nobody is signed in" is a
  // successful answer, and answering 401 would only fill the console with noise.
  .get('/me', async (c) => c.json({ user: c.get('user') ?? null }, 200))

  .delete('/sessions', async (c) => {
    const user = c.get('user')
    if (!user) throw apiError(401, 'unauthorized', 'Sign in to continue.')
    await c.get('db').delete(sessions).where(eq(sessions.userId, user.id))
    clearSessionCookie(c)
    return c.body(null, 204)
  })

export const authLimiter = attempts
