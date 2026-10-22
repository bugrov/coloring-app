import { and, asc, desc, eq, ilike, or } from 'drizzle-orm'
import type { Database } from '../../../core/server/utils/db'
import { users } from '../../../core/server/db/schema'
import type { AdminPlayer, ColoringArt, HistoryState, PlayerArt } from '../../shared'
import { PLAYER_SEARCH_LIMIT } from '../../shared/admin'
import { arts, progress } from '../db/schema'
import { loadHistory } from './history'

/** Escapes what LIKE treats as a pattern, so a name with `%` or `_` in it is searched as typed. */
function likePattern(text: string): string {
  return `${text.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
}

/** Players whose name starts with the text (case-insensitive), newest first. */
export async function searchPlayers(db: Database, query: string): Promise<AdminPlayer[]> {
  const rows = await db
    .select({ id: users.id, username: users.username, country: users.country })
    .from(users)
    .where(or(ilike(users.usernameKey, likePattern(query.toLowerCase())), ilike(users.username, likePattern(query))))
    .orderBy(desc(users.createdAt), asc(users.username))
    .limit(PLAYER_SEARCH_LIMIT)
  return rows
}

export async function getPlayer(db: Database, userId: string): Promise<AdminPlayer | null> {
  const [row] = await db.select({ id: users.id, username: users.username, country: users.country }).from(users).where(eq(users.id, userId)).limit(1)
  return row ?? null
}

/** The arts a player has started, with every attempt: how far it got and how many steps it holds. */
export async function listPlayerArts(db: Database, userId: string): Promise<PlayerArt[]> {
  const rows = await db
    .select({
      artId: arts.id,
      title: arts.title,
      attempt: progress.attempt,
      percent: progress.percent,
      completed: progress.completed,
      steps: progress.stepCount,
      updatedAt: progress.updatedAt,
    })
    .from(progress)
    .innerJoin(arts, eq(arts.id, progress.artId))
    .where(eq(progress.userId, userId))
    .orderBy(desc(progress.updatedAt), desc(progress.attempt))

  const byArt = new Map<string, PlayerArt>()
  for (const row of rows) {
    const entry = byArt.get(row.artId) ?? { artId: row.artId, title: row.title, attempts: [] }
    entry.attempts.push({ attempt: row.attempt, percent: row.percent, completed: row.completed, steps: row.steps, updatedAt: row.updatedAt.toISOString() })
    byArt.set(row.artId, entry)
  }
  return [...byArt.values()]
}

export interface PlayerArtState {
  title: string
  art: ColoringArt
  history: HistoryState
}

/**
 * What a player's attempt looks like: the art and the whole history of the attempt (the latest one
 * unless `attempt` is given). Read only: the administrator replays it, nothing is changed. Null when
 * the player never started the art.
 */
export async function loadPlayerArtState(db: Database, userId: string, artId: string, attempt?: number): Promise<PlayerArtState | null> {
  const [art] = await db.select({ title: arts.title, data: arts.data }).from(arts).where(eq(arts.id, artId)).limit(1)
  if (!art) return null
  const [started] = await db
    .select({ id: progress.id })
    .from(progress)
    .where(and(eq(progress.userId, userId), eq(progress.artId, artId), attempt === undefined ? undefined : eq(progress.attempt, attempt)))
    .limit(1)
  if (!started) return null
  return { title: art.title, art: art.data, history: await loadHistory(db, userId, artId, attempt) }
}
