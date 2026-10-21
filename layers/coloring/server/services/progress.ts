import { and, desc, eq } from 'drizzle-orm'
import type { Database } from '../../../core/server/utils/db'
import { progress } from '../db/schema'

export type RestartResult = { ok: true, attempt: number } | { ok: false, reason: 'not_started' }

/**
 * "Start over": a new attempt with clean progress. The old attempt stays (analytics, admin).
 * Nothing to restart before the first attempt exists. The unique (user, art, attempt) key makes
 * two parallel restarts add one attempt, not two: the loser reads the winner's row.
 */
export async function restartArt(db: Database, userId: string, artId: string): Promise<RestartResult> {
  const latest = async () => (await db
    .select({ attempt: progress.attempt })
    .from(progress)
    .where(and(eq(progress.userId, userId), eq(progress.artId, artId)))
    .orderBy(desc(progress.attempt))
    .limit(1))[0]

  const current = await latest()
  if (!current) return { ok: false, reason: 'not_started' }

  await db
    .insert(progress)
    .values({ userId, artId, attempt: current.attempt + 1 })
    .onConflictDoNothing({ target: [progress.userId, progress.artId, progress.attempt] })

  const after = await latest()
  return { ok: true, attempt: after?.attempt ?? current.attempt + 1 }
}
