import { and, desc, eq, sql } from 'drizzle-orm'
import { rowsOf, type Database } from '../../../core/server/utils/db'
import type { HistoryState, SaveHistoryRequest } from '../../shared'
import { progress } from '../db/schema'

export type SaveHistoryOutcome = { ok: true, attempt: number, rev: number } | { ok: false, reason: 'conflict' }

const EMPTY_HISTORY: HistoryState = { attempt: 0, rev: 0, cursor: 0, steps: [] }

async function latestAttempt(db: Database, userId: string, artId: string) {
  const [row] = await db
    .select({ id: progress.id, attempt: progress.attempt, rev: progress.rev })
    .from(progress)
    .where(and(eq(progress.userId, userId), eq(progress.artId, artId)))
    .orderBy(desc(progress.attempt))
    .limit(1)
  return row
}

/**
 * The player's latest attempt at the art with all its steps, read in one statement so the steps
 * always belong to the revision and the cursor that come with them. Before the first attempt the
 * history is empty (attempt 0). `attempt` asks for a given attempt instead of the latest (the admin).
 */
export async function loadHistory(db: Database, userId: string, artId: string, attempt?: number): Promise<HistoryState> {
  const result = await db.execute(sql`
    SELECT p.attempt, p.rev, p.cursor,
      COALESCE(
        (SELECT jsonb_agg(h.ops ORDER BY h.seq) FROM history_steps h WHERE h.progress_id = p.id AND h.seq <= p.step_count),
        '[]'::jsonb
      ) AS steps
    FROM progress p
    WHERE p.user_id = ${userId} AND p.art_id = ${artId} ${attempt === undefined ? sql`` : sql`AND p.attempt = ${attempt}`}
    ORDER BY p.attempt DESC
    LIMIT 1
  `)
  return rowsOf<HistoryState>(result)[0] ?? { ...EMPTY_HISTORY }
}

/**
 * Stores a save: the first `keep` steps stay, the rest is replaced by `steps`, the cursor and the
 * progress are set. One statement does it all (the Neon HTTP driver has no transactions): the row
 * is only updated when `rev` is still the one the client built on, and the step rows follow from
 * that update, so a save either lands whole or not at all. A save on an outdated revision, for
 * another attempt, or that would leave a gap in the steps is a conflict.
 *
 * Before the first attempt (the client sends attempt 0) the attempt is created here; two devices
 * doing so at once end up with one attempt, and the second one's save is a conflict.
 */
export async function saveHistory(db: Database, userId: string, artId: string, save: SaveHistoryRequest): Promise<SaveHistoryOutcome> {
  let current = await latestAttempt(db, userId, artId)
  if (!current) {
    if (save.attempt !== 0) return { ok: false, reason: 'conflict' }
    await db.insert(progress).values({ userId, artId, attempt: 1 }).onConflictDoNothing({ target: [progress.userId, progress.artId, progress.attempt] })
    current = await latestAttempt(db, userId, artId)
    if (!current) return { ok: false, reason: 'conflict' }
  }
  else if (save.attempt !== current.attempt) {
    return { ok: false, reason: 'conflict' }
  }

  const stepCount = save.keep + save.steps.length
  const result = await db.execute(sql`
    WITH saved AS (
      UPDATE progress
      SET rev = rev + 1, cursor = ${save.cursor}, step_count = ${stepCount},
          percent = ${save.percent}, completed = ${save.percent === 100}, updated_at = now()
      WHERE id = ${current.id} AND rev = ${save.rev} AND step_count >= ${save.keep}
      RETURNING id, attempt, rev
    ),
    stored AS (
      INSERT INTO history_steps (progress_id, seq, ops)
      SELECT saved.id, ${save.keep} + t.position, t.ops
      FROM saved, jsonb_array_elements(${JSON.stringify(save.steps)}::jsonb) WITH ORDINALITY AS t(ops, position)
      ON CONFLICT (progress_id, seq) DO UPDATE SET ops = EXCLUDED.ops
    ),
    cut AS (
      DELETE FROM history_steps
      WHERE progress_id IN (SELECT id FROM saved) AND seq > ${stepCount}
    )
    SELECT attempt, rev FROM saved
  `)
  const [row] = rowsOf<{ attempt: number, rev: number }>(result)
  return row ? { ok: true, attempt: row.attempt, rev: row.rev } : { ok: false, reason: 'conflict' }
}
