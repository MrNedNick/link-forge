import type { Database } from './db/client.js'

export type SessionUser = {
  id: string
  email: string
  createdAt: Date
}

export type AppEnv = {
  Variables: {
    db: Database
    user?: SessionUser
  }
}
