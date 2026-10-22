import { and, desc, eq, inArray, lt, max, or, sql } from 'drizzle-orm'
import { GALLERY_PAGE_SIZE, IMPORT_LIMIT, PERCENT_MAX } from '../../shared/gallery'
import type { ColoringArt, GalleryItem, GalleryPage } from '../../shared'
import type { Database } from '../../../core/server/utils/db'
import { arts, progress, type ArtRow } from '../db/schema'

/**
 * An import is visible to its owner only. A built-in or admin art is visible once it is published,
 * and then to everyone, unless the administrator assigned it: with assignments only to the players
 * of the countries and the players listed.
 */
const visibleTo = (userId: string) => or(
  and(eq(arts.source, 'user'), eq(arts.ownerId, userId)),
  and(
    inArray(arts.source, ['builtin', 'admin']),
    eq(arts.status, 'published'),
    sql`(
      NOT EXISTS (SELECT 1 FROM art_assignments a WHERE a.art_id = ${arts.id})
      OR EXISTS (
        SELECT 1 FROM art_assignments a
        WHERE a.art_id = ${arts.id}
          AND (a.user_id = ${userId} OR a.country = (SELECT u.country FROM users u WHERE u.id = ${userId}))
      )
    )`,
  ),
)

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
      thumbnailAt: progress.thumbnailAt,
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
    // Admin arts are the app's own for a player, like the built-in ones: not theirs to delete.
    source: row.source === 'user' ? 'user' : 'builtin',
    percent: Math.min(row.percent ?? 0, PERCENT_MAX),
    attempt: row.attempt ?? 0,
    completed: row.completed ?? false,
    thumbnail: row.thumbnailAt?.getTime() ?? null,
  }))
  const last = page.at(-1)

  return { items, nextCursor: rows.length > GALLERY_PAGE_SIZE && last ? String(last.seq) : null }
}

/** The art, if this player may see it; null otherwise (also for someone else's import). */
export async function findVisibleArt(db: Database, userId: string, artId: string): Promise<ArtRow | null> {
  const [row] = await db.select().from(arts).where(and(eq(arts.id, artId), visibleTo(userId))).limit(1)

  return row ?? null
}

/** Whether the player may see the art; reads no more than its id (the art itself can be large). */
export async function artIsVisible(db: Database, userId: string, artId: string): Promise<boolean> {
  const [row] = await db.select({ id: arts.id }).from(arts).where(and(eq(arts.id, artId), visibleTo(userId))).limit(1)

  return row !== undefined
}

/**
 * The ids of the regions of an art are kept per server instance, for a while. An art is replaced by a new
 * id when it changes, except the built-in ones, which a re-seed rewrites under the same id: the time limit
 * keeps a warm instance from checking steps against regions that are gone.
 */
const REGION_IDS_CACHE_SIZE = 100
const REGION_IDS_TTL_MS = 5 * 60_000
const regionIds = new Map<string, { ids: ReadonlySet<number>, at: number }>()

/**
 * The ids of the paintable regions of an art, or null when there is no such art. Saving the history
 * checks every step against them, every few seconds while someone draws: the art itself (up to 2 MB)
 * is read once, not each time. Whether the player may see the art is a separate question (`artIsVisible`).
 */
export async function getRegionIds(db: Database, artId: string): Promise<ReadonlySet<number> | null> {
  const cached = regionIds.get(artId)

  if (cached && Date.now() - cached.at < REGION_IDS_TTL_MS) {
    // Used again: it goes to the back of the line, so the one that is not used for longest is dropped first.
    regionIds.delete(artId)
    regionIds.set(artId, cached)

    return cached.ids
  }
  regionIds.delete(artId)
  const [row] = await db.select({ data: arts.data }).from(arts).where(eq(arts.id, artId)).limit(1)

  if (!row) return null
  const ids = new Set(row.data.items.flatMap(item => (item.type === 'region' ? [item.id] : [])))

  if (regionIds.size >= REGION_IDS_CACHE_SIZE) regionIds.delete(regionIds.keys().next().value!)
  regionIds.set(artId, { ids, at: Date.now() })

  return ids
}

/** True when the player keeps `IMPORT_LIMIT` imports already. Cheap: checked before the costly SVG conversion. */
export async function importLimitReached(db: Database, userId: string): Promise<boolean> {
  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(arts)
    .where(and(eq(arts.ownerId, userId), eq(arts.source, 'user')))

  return total >= IMPORT_LIMIT
}

export type ImportResult = { ok: true, id: string } | { ok: false, reason: 'limit_reached' }

/**
 * Stores a converted import for its owner, unless they already keep `IMPORT_LIMIT`. Count and
 * insert are separate statements (the Neon HTTP driver has no interactive transactions), so
 * parallel requests could overshoot by a few; the import route is rate limited.
 */
export async function importArt(db: Database, userId: string, title: string, data: ColoringArt): Promise<ImportResult> {
  if (await importLimitReached(db, userId)) return { ok: false, reason: 'limit_reached' }

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
