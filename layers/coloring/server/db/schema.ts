import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { users } from '../../../core/server/db/schema'
import type { ColoringArt } from '../../shared'

export const ART_SOURCES = ['builtin', 'user'] as const
export type ArtSource = typeof ART_SOURCES[number]

export const arts = pgTable('arts', {
  id: uuid().primaryKey().defaultRandom(),
  /**
   * Insertion order. The gallery lists newest first and pages by it (keyset): a unique,
   * strictly increasing number needs no tie-breaker and keeps the cursor exact.
   */
  seq: bigint({ mode: 'number' }).generatedAlwaysAsIdentity().notNull().unique(),
  source: text().$type<ArtSource>().notNull(),
  /** Stable name of a built-in art ('octopus'); the seed upserts by it. Null for imports. */
  builtinKey: text('builtin_key').unique(),
  /** Set for imports: the player who owns the art. Deleting the user deletes the art. */
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }),
  title: text().notNull(),
  /** Normalized art (never the source SVG), validated by `artSchema` before it is stored. */
  data: jsonb().$type<ColoringArt>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index('arts_owner_id_idx').on(table.ownerId),
])

/** One attempt at colouring an art. "Start over" adds an attempt; older ones stay. */
export const progress = pgTable('progress', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  artId: uuid('art_id').notNull().references(() => arts.id, { onDelete: 'cascade' }),
  attempt: integer().notNull().default(1),
  /** Whole percent of the drawing painted, 0-100. */
  percent: integer().notNull().default(0),
  completed: boolean().notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  unique('progress_user_art_attempt_unique').on(table.userId, table.artId, table.attempt),
])

export type ArtRow = typeof arts.$inferSelect
export type ProgressRow = typeof progress.$inferSelect
