import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createApp } from './app.js'
import { getDatabase } from './db/client.js'
import { runMigrations } from './db/migrate.js'
import { env } from './env.js'

const handle = await getDatabase()

// The server owns its schema: starting it on an empty database is enough.
await runMigrations(handle)

const app = createApp({ db: handle.db })

if (env.isProduction) {
  app.use('/assets/*', serveStatic({ root: './dist' }))
  app.use('/favicon.svg', serveStatic({ root: './dist' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))
  if (!existsSync('./dist/index.html')) {
    console.warn('dist/index.html is missing - run `npm run build` before `npm start`.')
  }
} else {
  // In development the dashboard is served by Vite; the API keeps the root path
  // so short links work at their real address.
  const web = process.env.WEB_ORIGIN ?? 'http://localhost:5173'
  app.get('*', (c) => c.redirect(web + c.req.path, 302))
}

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`link-forge api    http://localhost:${info.port}`)
  console.log(`database          ${handle.kind === 'pglite' ? `pglite (${env.pgliteDir})` : 'postgres'}`)
  console.log(`short links       ${env.publicBaseUrl}/<code>`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void handle.close().finally(() => process.exit(0))
  })
}
