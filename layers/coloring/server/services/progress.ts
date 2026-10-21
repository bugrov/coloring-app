import { and, desc, eq } from 'drizzle-orm'
import type { Database } from '../../../core/server/utils/db'
import { progress } from '../db/schema'

export type RestartResult = { ok: true, attempt: number } | { ok: false, reason: 'not_started' }

async function latestAttempt(db: Database, userId: string, artId: string) {
  const [row] = await db
    .select({ attempt: progress.attempt, percent: progress.percent, stepCount: progress.stepCount })
    .from(progress)
    .where(and(eq(progress.userId, userId), eq(progress.artId, artId)))
    .orderBy(desc(progress.attempt))
    .limit(1)
  return row
}

/**
 * "Start over": a new attempt with clean progress. The old attempt stays (analytics, admin).
 * Nothing to restart before the first attempt exists, and an attempt without painted area or steps is
 * already clean, so it is returned as it is (repeated taps do not pile up empty attempts).
 * The unique (user, art, attempt) key makes two parallel restarts add one attempt, not two:
 * the loser reads the winner's row.
 */
export async function restartArt(db: Database, userId: string, artId: string): Promise<RestartResult> {
  const current = await latestAttempt(db, userId, artId)
  if (!current) return { ok: false, reason: 'not_started' }
  // Nothing painted and no steps: the attempt is clean already (a stroke too faint to count still is a step).
  if (current.percent === 0 && current.stepCount === 0) return { ok: true, attempt: current.attempt }

  await db
    .insert(progress)
    .values({ userId, artId, attempt: current.attempt + 1 })
    .onConflictDoNothing({ target: [progress.userId, progress.artId, progress.attempt] })

  const after = await latestAttempt(db, userId, artId)
  return { ok: true, attempt: after?.attempt ?? current.attempt + 1 }
}
