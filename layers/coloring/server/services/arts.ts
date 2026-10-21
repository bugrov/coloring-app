import { and, desc, eq, lt, max, or, sql } from 'drizzle-orm'
import { GALLERY_PAGE_SIZE, IMPORT_LIMIT, PERCENT_MAX } from '../../shared/gallery'
import type { ColoringArt, GalleryItem, GalleryPage } from '../../shared'
import type { Database } from '../../../core/server/utils/db'
import { arts, progress, type ArtRow } from '../db/schema'

/** Built-in arts are visible to everyone; an import only to its owner. */
const visibleTo = (userId: string) => or(eq(arts.source, 'builtin'), eq(arts.ownerId, userId))

/**
 * One gallery page, newest first, by keyset on `arts.seq` (no OFFSET: the cost does not grow with
 * the page number). Each card carries the player's latest attempt; the joins are by that
 * attempt only, so older attempts never show.
 */
export async function listGallery(db: Database, userId: string, cursor?: number): Promise<GalleryPage> {
  const latest = db
    .select({ artId: progress.artId, latestAttempt: max(progress.attempt).as('latest_attempt') })
    .from(progress)
    .where(eq(progress.userId, userId))
    .groupBy(progress.artId)
    .as('latest')

  const rows = await db
    .select({
      id: arts.id,
      seq: arts.seq,
      title: arts.title,
      source: arts.source,
      attempt: progress.attempt,
      percent: progress.percent,
      completed: progress.completed,
    })
    .from(arts)
    .leftJoin(latest, eq(latest.artId, arts.id))
    .leftJoin(progress, and(eq(progress.artId, arts.id), eq(progress.userId, userId), eq(progress.attempt, latest.latestAttempt)))
    .where(and(visibleTo(userId), cursor === undefined ? undefined : lt(arts.seq, cursor)))
    .orderBy(desc(arts.seq))
    .limit(GALLERY_PAGE_SIZE + 1)

  const page = rows.slice(0, GALLERY_PAGE_SIZE)
  const items: GalleryItem[] = page.map(row => ({
    id: row.id,
    title: row.title,
    source: row.source,
    percent: Math.min(row.percent ?? 0, PERCENT_MAX),
    attempt: row.attempt ?? 0,
    completed: row.completed ?? false,
  }))
  const last = page.at(-1)
  return { items, nextCursor: rows.length > GALLERY_PAGE_SIZE && last ? String(last.seq) : null }
}

/** The art, if this player may see it; null otherwise (also for someone else's import). */
export async function findVisibleArt(db: Database, userId: string, artId: string): Promise<ArtRow | null> {
  const [row] = await db.select().from(arts).where(and(eq(arts.id, artId), visibleTo(userId))).limit(1)
  return row ?? null
}

export type ImportResult = { ok: true, id: string } | { ok: false, reason: 'limit_reached' }

/**
 * Stores a converted import for its owner, unless they already keep `IMPORT_LIMIT`. Count and
 * insert are separate statements (the Neon HTTP driver has no interactive transactions), so
 * parallel requests could overshoot by a few; the import route is rate limited.
 */
export async function importArt(db: Database, userId: string, title: string, data: ColoringArt): Promise<ImportResult> {
  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(arts)
    .where(and(eq(arts.ownerId, userId), eq(arts.source, 'user')))
  if (total >= IMPORT_LIMIT) return { ok: false, reason: 'limit_reached' }

  const [row] = await db.insert(arts).values({ source: 'user', ownerId: userId, title, data }).returning({ id: arts.id })
  if (!row) throw new Error('import insert returned no row')
  return { ok: true, id: row.id }
}

/** Deletes the player's own import with its attempts (cascade). False for anything else. */
export async function deleteImport(db: Database, userId: string, artId: string): Promise<boolean> {
  const deleted = await db
    .delete(arts)
    .where(and(eq(arts.id, artId), eq(arts.ownerId, userId), eq(arts.source, 'user')))
    .returning({ id: arts.id })
  return deleted.length > 0
}
