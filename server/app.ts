import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import type { Database } from './db/client.js'
import { env } from './env.js'
import { noticePage } from './lib/page.js'
import { resolveSession, sessionToken } from './lib/session.js'
import { isReservedCode, isValidCode } from './lib/slug.js'
import { authRoutes } from './routes/auth.js'
import { linkRoutes } from './routes/links.js'
import { handleRedirect } from './routes/redirect.js'
import { statsRoutes } from './routes/stats.js'
import type { AppEnv } from './types.js'

export function createApp({ db, quiet = false }: { db: Database; quiet?: boolean }) {
  const app = new Hono<AppEnv>()

  if (!quiet) app.use('*', logger())
  app.use('*', secureHeaders())

  app.use('*', async (c, next) => {
    c.set('db', db)
    const user = await resolveSession(db, sessionToken(c))
    if (user) c.set('user', user)
    await next()
  })

  app.get('/health', (c) => c.json({ ok: true, database: env.databaseUrl ? 'postgres' : 'pglite' }))

  app.route('/api/auth', authRoutes)
  app.route('/api/links', linkRoutes)
  app.route('/api/stats', statsRoutes)

  app.all('/api/*', (c) =>
    c.json({ error: { code: 'not_found', message: 'No such endpoint.' } }, 404),
  )

  // Short links live at the root, which is the whole point of a short link.
  // /r/:code stays available for hosts that already own the root path.
  app.get('/r/:code', (c) => handleRedirect(c, c.req.param('code')))
  app.get('/:code', async (c, next) => {
    const code = c.req.param('code')
    if (isReservedCode(code) || !isValidCode(code) || code.includes('.')) return next()
    return handleRedirect(c, code)
  })

  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse()
    console.error(error)
    if (c.req.path.startsWith('/api/')) {
      return c.json({ error: { code: 'invalid', message: 'Something broke on our side.' } }, 500)
    }
    return noticePage({
      status: 500,
      title: 'Something broke',
      message: 'The server could not finish that request. It has been logged.',
      home: env.publicBaseUrl,
    })
  })

  return app
}

export type App = ReturnType<typeof createApp>
