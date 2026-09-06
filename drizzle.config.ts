import { defineConfig } from 'drizzle-kit'

// Migrations are generated for the Postgres dialect and are the single source
// of truth for both targets: PGlite locally, a Postgres server in production.
export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
})
