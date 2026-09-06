import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { env } from '../env.js'
import * as schema from './schema.js'

/**
 * Two drivers, one dialect. Locally the app talks to PGlite — real Postgres
 * compiled to WebAssembly, running inside this process — so `npm run dev` needs
 * no daemon and no container. Point DATABASE_URL at a Postgres server and the
 * exact same schema, migrations and queries run against it instead.
 */
/**
 * The dialect-level type, not a driver-level one: every query in this app is
 * written against Postgres, and which driver executes it is an env variable.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>

export type DatabaseHandle = {
  kind: 'pglite' | 'postgres'
  db: Database
  close: () => Promise<void>
}

export async function createDatabase(
  options: { url?: string; pgliteDir?: string } = {},
): Promise<DatabaseHandle> {
  const url = options.url ?? env.databaseUrl

  if (url) {
    const [{ drizzle }, pg] = await Promise.all([
      import('drizzle-orm/node-postgres'),
      import('pg'),
    ])
    const pool = new pg.default.Pool({ connectionString: url, max: 10 })
    return {
      kind: 'postgres',
      db: drizzle(pool, { schema }) as unknown as Database,
      close: () => pool.end(),
    }
  }

  const dir = options.pgliteDir ?? env.pgliteDir
  const [{ drizzle }, { PGlite }] = await Promise.all([
    import('drizzle-orm/pglite'),
    import('@electric-sql/pglite'),
  ])
  if (dir !== ':memory:') mkdirSync(dirname(dir), { recursive: true })
  const client = new PGlite(dir === ':memory:' ? undefined : dir)
  await client.waitReady
  return {
    kind: 'pglite',
    db: drizzle(client, { schema }) as unknown as Database,
    close: () => client.close(),
  }
}

let shared: DatabaseHandle | undefined

/** Process-wide handle, created on first use. */
export async function getDatabase() {
  shared ??= await createDatabase()
  return shared
}

export { schema }
