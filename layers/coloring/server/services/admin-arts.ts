import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { Database } from '../../../core/server/utils/db'
import type { AdminArt, ColoringArt } from '../../shared'
import { users } from '../../../core/server/db/schema'
import { artAssignments, arts, artEvents, type ArtStatus } from '../db/schema'

const ADMIN_SOURCES = ['builtin', 'admin'] as const

/** Every built-in and admin art with its counters and who it is assigned to; players' imports are not listed. */
export async function listAdminArts(db: Database): Promise<AdminArt[]> {
  const counts = db
    .select({
      artId: artEvents.artId,
      opens: sql<number>`count(*) FILTER (WHERE ${artEvents.type} = 'open')::int`.as('opens'),
      starts: sql<number>`count(*) FILTER (WHERE ${artEvents.type} = 'start')::int`.as('starts'),
      completes: sql<number>`count(*) FILTER (WHERE ${artEvents.type} = 'complete')::int`.as('completes'),
    })
    .from(artEvents)
    .groupBy(artEvents.artId)
    .as('counts')

  const rows = await db
    .select({
      id: arts.id,
      title: arts.title,
      source: arts.source,
      status: arts.status,
      opens: sql<number>`coalesce(${counts.opens}, 0)::int`,
      starts: sql<number>`coalesce(${counts.starts}, 0)::int`,
      completes: sql<number>`coalesce(${counts.completes}, 0)::int`,
    })
    .from(arts)
    .leftJoin(counts, eq(counts.artId, arts.id))
    .where(inArray(arts.source, ADMIN_SOURCES))
    .orderBy(desc(arts.seq))

  const assigned = await db
    .select({ artId: artAssignments.artId, country: artAssignments.country, userId: artAssignments.userId, username: users.username, playerCountry: users.country })
    .from(artAssignments)
    .leftJoin(users, eq(users.id, artAssignments.userId))
    .where(inArray(artAssignments.artId, rows.map(row => row.id)))

  return rows.map(row => ({
    ...row,
    source: row.source === 'admin' ? 'admin' : 'builtin',
    assignedCountries: assigned.filter(entry => entry.artId === row.id && entry.country).map(entry => entry.country!),
    assignedPlayers: assigned
      .filter(entry => entry.artId === row.id && entry.userId)
      .map(entry => ({ id: entry.userId!, username: entry.username!, country: entry.playerCountry! })),
  }))
}

export interface AdminArtDetails {
  id: string
  title: string
  source: 'builtin' | 'admin'
  status: ArtStatus
  art: ColoringArt
}

/** One built-in or admin art with its art data, for the preview before publishing. Null for anything else. */
export async function getAdminArt(db: Database, artId: string): Promise<AdminArtDetails | null> {
  const [row] = await db
    .select({ id: arts.id, title: arts.title, source: arts.source, status: arts.status, art: arts.data })
    .from(arts)
    .where(and(eq(arts.id, artId), inArray(arts.source, ADMIN_SOURCES)))
    .limit(1)
  return row ? { ...row, source: row.source === 'admin' ? 'admin' : 'builtin' } : null
}

/** Stores an uploaded art as a draft: players do not see it until it is published. */
export async function createAdminArt(db: Database, title: string, data: ColoringArt): Promise<string> {
  const [row] = await db.insert(arts).values({ source: 'admin', status: 'draft', title, data }).returning({ id: arts.id })
  if (!row) throw new Error('art insert returned no row')
  return row.id
}

/** Changes the title and/or status of a built-in or admin art; false when there is no such art. */
export async function updateAdminArt(db: Database, artId: string, patch: { title?: string, status?: ArtStatus }): Promise<boolean> {
  const updated = await db
    .update(arts)
    .set(patch)
    .where(and(eq(arts.id, artId), inArray(arts.source, ADMIN_SOURCES)))
    .returning({ id: arts.id })
  return updated.length > 0
}

/** Deletes an admin art with its attempts and events. Built-in arts are hidden instead (the seed would bring them back). */
export async function deleteAdminArt(db: Database, artId: string): Promise<boolean> {
  const deleted = await db.delete(arts).where(and(eq(arts.id, artId), eq(arts.source, 'admin'))).returning({ id: arts.id })
  return deleted.length > 0
}

/**
 * Makes the art's assignments exactly these countries and players: new ones are added, the ones not
 * listed are removed. One statement (the Neon HTTP driver has no transactions), and the two parts touch
 * different rows, so the art is never briefly open to everyone in between. A player id that does not
 * exist is skipped. Returns false when there is no such art.
 */
export async function setAssignments(db: Database, artId: string, assignment: { countries: string[], players: string[] }): Promise<boolean> {
  if (!await getAdminArt(db, artId)) return false
  // The lists go in as JSON: a JS array in a sql template is spread into separate parameters, not an array.
  const countries = JSON.stringify(assignment.countries)
  const players = JSON.stringify(assignment.players)
  await db.execute(sql`
    WITH added_countries AS (
      INSERT INTO art_assignments (art_id, country)
      SELECT ${artId}::uuid, c FROM jsonb_array_elements_text(${countries}::jsonb) AS c
      ON CONFLICT DO NOTHING
    ),
    added_players AS (
      INSERT INTO art_assignments (art_id, user_id)
      SELECT ${artId}::uuid, u.id FROM users u WHERE u.id::text IN (SELECT jsonb_array_elements_text(${players}::jsonb))
      ON CONFLICT DO NOTHING
    )
    DELETE FROM art_assignments
    WHERE art_id = ${artId}::uuid
      AND NOT (
        COALESCE(country IN (SELECT jsonb_array_elements_text(${countries}::jsonb)), false)
        OR COALESCE(user_id::text IN (SELECT jsonb_array_elements_text(${players}::jsonb)), false)
      )
  `)
  return true
}
