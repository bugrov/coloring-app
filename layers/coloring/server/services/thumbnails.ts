import { and, eq, isNotNull } from 'drizzle-orm'
import type { Database } from '../../../core/server/utils/db'
import { THUMBNAIL_MAX_BYTES } from '../../shared/gallery'
import { progress } from '../db/schema'
import { latestAttempt } from './attempts'

/** Where the thumbnail files live: Vercel Blob in the app, memory in tests and in development without a store. */
export interface ThumbnailStore {
  put: (pathname: string, body: Uint8Array, contentType: string) => Promise<void>
  get: (pathname: string) => Promise<{ stream: ReadableStream<Uint8Array>, contentType: string } | null>
  remove: (pathnames: string[]) => Promise<void>
}

export type SaveThumbnailResult = { ok: true } | { ok: false, reason: 'not_started' | 'invalid' }

export type ThumbnailType = 'image/webp' | 'image/png'

const pathOf = (progressId: string) => `thumbnails/${progressId}`

const matches = (bytes: Uint8Array, offset: number, signature: string) => [...signature].every((char, index) => bytes[offset + index] === char.charCodeAt(0))

/**
 * What the bytes really are, by their signature and not by what the client claims: only WebP
 * (RIFF....WEBP) and PNG are stored, so the file served back is always an image.
 */
export function detectThumbnailType(bytes: Uint8Array): ThumbnailType | null {
  if (matches(bytes, 0, 'RIFF') && matches(bytes, 8, 'WEBP')) return 'image/webp'
  if (bytes[0] === 0x89 && matches(bytes, 1, 'PNG')) return 'image/png'

  return null
}

/** Stores the thumbnail of the latest attempt of the player; there is none before the first save of the history. */
export async function saveThumbnail(db: Database, store: ThumbnailStore, userId: string, artId: string, bytes: Uint8Array): Promise<SaveThumbnailResult> {
  const type = detectThumbnailType(bytes)

  if (!type || bytes.length > THUMBNAIL_MAX_BYTES) return { ok: false, reason: 'invalid' }
  const latest = await latestAttempt(db, userId, artId)

  if (!latest) return { ok: false, reason: 'not_started' }

  await store.put(pathOf(latest.id), bytes, type)
  await db.update(progress).set({ thumbnailAt: new Date() }).where(eq(progress.id, latest.id))

  return { ok: true }
}

/** The thumbnail of the latest attempt of the player, or null when there is none. */
export async function readThumbnail(db: Database, store: ThumbnailStore, userId: string, artId: string) {
  // Only the latest attempt counts: after "start over" an older attempt's picture must not come back.
  const latest = await latestAttempt(db, userId, artId)

  return latest?.thumbnailAt ? store.get(pathOf(latest.id)) : null
}

/** Paths of every thumbnail stored for the art, to remove together with it. */
export async function thumbnailPathsOfArt(db: Database, artId: string): Promise<string[]> {
  const rows = await db.select({ id: progress.id }).from(progress).where(and(eq(progress.artId, artId), isNotNull(progress.thumbnailAt)))

  return rows.map(row => pathOf(row.id))
}
