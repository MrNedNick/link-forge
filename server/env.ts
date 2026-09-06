const bool = (value: string | undefined, fallback: boolean) =>
  value === undefined ? fallback : value === '1' || value.toLowerCase() === 'true'

const isProduction = process.env.NODE_ENV === 'production'

export const env = {
  isProduction,
  isTest: process.env.NODE_ENV === 'test',
  port: Number(process.env.PORT ?? 8787),
  /** Origin short links are built on. Must be the origin serving the redirects. */
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? 'http://localhost:8787').replace(/\/+$/, ''),
  /** Empty means the embedded Postgres under ./.data/pglite. */
  databaseUrl: process.env.DATABASE_URL?.trim() || '',
  /** Directory PGlite persists to. `:memory:` keeps the database in RAM. */
  pgliteDir: process.env.PGLITE_DIR?.trim() || './.data/pglite',
  secureCookies: bool(process.env.SECURE_COOKIES, isProduction),
  /** Salt for the visitor fingerprint. Raw IP addresses are never stored. */
  visitorSalt: process.env.VISITOR_SALT ?? 'link-forge-dev-salt',
}

export type Env = typeof env
