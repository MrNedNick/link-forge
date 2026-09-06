import { relations, sql } from 'drizzle-orm'
import {
  bigserial,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_email_key').on(sql`lower(${table.email})`)],
)

/**
 * Sessions live in the database, not in a signed cookie: the cookie carries an
 * opaque token, the row carries its SHA-256. Logging out, or deleting the user,
 * kills the session server-side — a stateless JWT cannot do that.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
)

export const links = pgTable(
  'links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    url: text('url').notNull(),
    title: text('title'),
    /** Postgres array + GIN index: one column, no join table, still indexed. */
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('links_code_key').on(table.code),
    index('links_user_id_idx').on(table.userId),
    index('links_tags_idx').using('gin', table.tags),
  ],
)

export const clicks = pgTable(
  'clicks',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    linkId: uuid('link_id')
      .notNull()
      .references(() => links.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Referrer host, or 'direct' when the browser sent none. */
    source: text('source').notNull().default('direct'),
    country: text('country').notNull().default('Unknown'),
    device: text('device').notNull().default('desktop'),
    browser: text('browser').notNull().default('Unknown'),
    /** Salted hash of IP + user agent. The raw address is never persisted. */
    visitorHash: text('visitor_hash').notNull(),
  },
  (table) => [
    index('clicks_link_id_idx').on(table.linkId),
    index('clicks_created_at_idx').on(table.createdAt),
  ],
)

export const usersRelations = relations(users, ({ many }) => ({
  links: many(links),
  sessions: many(sessions),
}))

export const linksRelations = relations(links, ({ one, many }) => ({
  user: one(users, { fields: [links.userId], references: [users.id] }),
  clicks: many(clicks),
}))

export const clicksRelations = relations(clicks, ({ one }) => ({
  link: one(links, { fields: [clicks.linkId], references: [links.id] }),
}))

export type User = typeof users.$inferSelect
export type Link = typeof links.$inferSelect
export type Click = typeof clicks.$inferSelect
export type NewClick = typeof clicks.$inferInsert
