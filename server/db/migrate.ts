import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createDatabase, type DatabaseHandle } from './client.js'

const migrationsFolder = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../drizzle',
)

/** Applies every pending migration. Safe to run on an already-current database. */
export async function runMigrations(handle: Pick<DatabaseHandle, 'kind' | 'db'>) {
  if (handle.kind === 'pglite') {
    const { migrate } = await import('drizzle-orm/pglite/migrator')
    await migrate(handle.db as never, { migrationsFolder })
  } else {
    const { migrate } = await import('drizzle-orm/node-postgres/migrator')
    await migrate(handle.db as never, { migrationsFolder })
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  const handle = await createDatabase()
  await runMigrations(handle)
  console.log(`migrations applied (${handle.kind})`)
  await handle.close()
}
