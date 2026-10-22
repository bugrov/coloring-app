import { and, desc, eq } from 'drizzle-orm'
import type { Database } from '../../../core/server/utils/db'
import { progress } from '../db/schema'

/** The player's newest attempt at an art (its row), or undefined when the art was never started. */
export async function latestAttempt(db: Database, userId: string, artId: string) {
  const [row] = await db
    .select({ id: progress.id, attempt: progress.attempt, rev: progress.rev, percent: progress.percent, stepCount: progress.stepCount, thumbnailAt: progress.thumbnailAt })
    .from(progress)
    .where(and(eq(progress.userId, userId), eq(progress.artId, artId)))
    .orderBy(desc(progress.attempt))
    .limit(1)

  return row
}
