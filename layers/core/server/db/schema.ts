import { char, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  /** As the user typed it (normalized), shown in the interface. */
  username: text().notNull(),
  /** Lowercased `username`: with `country` it is the unique, case-insensitive identity. */
  usernameKey: text('username_key').notNull(),
  /** ISO 3166-1 alpha-2. The same name in another country is another player. */
  country: char({ length: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  unique('users_username_key_country_unique').on(table.usernameKey, table.country),
])

export type UserRow = typeof users.$inferSelect
