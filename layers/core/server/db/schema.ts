import { char, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  /** As the user typed it (normalized), shown in the interface. */
  username: text().notNull(),
  /** Lowercased `username`: the unique, case-insensitive identity. */
  usernameKey: text('username_key').notNull().unique(),
  /** ISO 3166-1 alpha-2, fixed at the first sign-in. */
  country: char({ length: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type UserRow = typeof users.$inferSelect
