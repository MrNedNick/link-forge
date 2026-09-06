import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, lt } from 'drizzle-orm'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { Database } from '../db/client.js'
import { sessions, users } from '../db/schema.js'
import { env } from '../env.js'

export const SESSION_COOKIE = 'lf_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** The cookie holds the token; the table holds its hash. A leaked dump is not a set of usable cookies. */
const digest = (token: string) => createHash('sha256').update(token).digest('hex')

export async function createSession(
  db: Database,
  userId: string,
  userAgent: string | undefined,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db.insert(sessions).values({ id: digest(token), userId, userAgent: userAgent ?? null, expiresAt })
  // Opportunistic cleanup: expired rows never accumulate without a cron job.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
  return { token, expiresAt }
}

export async function resolveSession(db: Database, token: string | undefined) {
  if (!token) return undefined
  const [row] = await db
    .select({ id: users.id, email: users.email, createdAt: users.createdAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, digest(token)), gt(sessions.expiresAt, new Date())))
    .limit(1)
  return row
}

export async function destroySession(db: Database, token: string | undefined) {
  if (!token) return
  await db.delete(sessions).where(eq(sessions.id, digest(token)))
}

export function setSessionCookie(c: Context, token: string, expiresAt: Date) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: env.secureCookies,
    path: '/',
    expires: expiresAt,
  })
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}

export function sessionToken(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE)
}
