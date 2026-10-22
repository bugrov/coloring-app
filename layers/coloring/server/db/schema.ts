import { sql } from 'drizzle-orm'
import { bigint, boolean, char, check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { users } from '../../../core/server/db/schema'
import type { ArtStatus, ColoringArt, HistoryStep } from '../../shared'

/** `builtin`: seeded with the app; `user`: a player's import; `admin`: uploaded by the administrator. */
export const ART_SOURCES = ['builtin', 'user', 'admin'] as const
export type ArtSource = typeof ART_SOURCES[number]

/** Events of the analytics; `start` and `complete` count once per attempt. */
export const ART_EVENT_TYPES = ['open', 'start', 'complete', 'restart'] as const
export type ArtEventType = typeof ART_EVENT_TYPES[number]

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
  /** Imports of players ignore it (they are visible to their owner only). */
  status: text().$type<ArtStatus>().notNull().default('published'),
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
  /** Steps applied now (`history_steps` with a lower or equal `seq`); the rest is the redo branch. */
  cursor: integer().notNull().default(0),
  /** Steps stored in `history_steps` (their highest `seq`). */
  stepCount: integer('step_count').notNull().default(0),
  /** Counts accepted saves of the history: a save made on an older one is a conflict. */
  rev: integer().notNull().default(0),
  /** When the gallery thumbnail was last stored; null while there is none. */
  thumbnailAt: timestamp('thumbnail_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  unique('progress_user_art_attempt_unique').on(table.userId, table.artId, table.attempt),
])

/** The steps of an attempt, in order: one row is one user action (its ops are undone together). */
export const historySteps = pgTable('history_steps', {
  progressId: uuid('progress_id').notNull().references(() => progress.id, { onDelete: 'cascade' }),
  /** 1-based position in the attempt. */
  seq: integer().notNull(),
  ops: jsonb().$type<HistoryStep>().notNull(),
}, table => [
  primaryKey({ columns: [table.progressId, table.seq] }),
])

/**
 * Who may see a built-in or admin art. An art without rows is for everyone; with rows only for the
 * countries and players listed. Exactly one of `country` and `userId` is set in a row.
 */
export const artAssignments = pgTable('art_assignments', {
  id: uuid().primaryKey().defaultRandom(),
  artId: uuid('art_id').notNull().references(() => arts.id, { onDelete: 'cascade' }),
  /** ISO 3166-1 alpha-2. */
  country: char({ length: 2 }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
}, table => [
  uniqueIndex('art_assignments_country_unique').on(table.artId, table.country).where(sql`${table.country} is not null`),
  uniqueIndex('art_assignments_user_unique').on(table.artId, table.userId).where(sql`${table.userId} is not null`),
  check('art_assignments_one_target', sql`(${table.country} is null) <> (${table.userId} is null)`),
])

/** The analytics log. Written by the server when a player opens, starts, completes or restarts an art. */
export const artEvents = pgTable('art_events', {
  id: uuid().primaryKey().defaultRandom(),
  type: text().$type<ArtEventType>().notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  artId: uuid('art_id').notNull().references(() => arts.id, { onDelete: 'cascade' }),
  /** The player's attempt at the art the event belongs to (0 before the first one). */
  attempt: integer().notNull(),
  /** The player's country when it happened; the user's own row may change later. */
  country: char({ length: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index('art_events_art_type_time_idx').on(table.artId, table.type, table.createdAt),
  index('art_events_time_idx').on(table.createdAt),
  // The "once per attempt" events: a repeat is refused by the database, so counting is idempotent.
  uniqueIndex('art_events_once_per_attempt').on(table.userId, table.artId, table.attempt, table.type).where(sql`${table.type} in ('start', 'complete')`),
])

/** Settings the administrator changes; a missing key means the built-in default. */
export const appSettings = pgTable('app_settings', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type ArtRow = typeof arts.$inferSelect
export type ProgressRow = typeof progress.$inferSelect
