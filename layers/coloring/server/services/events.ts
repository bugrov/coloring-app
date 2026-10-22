import type { Database } from '../../../core/server/utils/db'
import { artEvents, type ArtEventType } from '../db/schema'

export interface ArtEvent {
  type: ArtEventType
  userId: string
  artId: string
  attempt: number
  /** The player's country now; stored with the event. */
  country: string
}

/**
 * Writes one analytics event. `start` and `complete` are refused by the database when the attempt
 * already has one (a partial unique index), so sending them again is harmless. An analytics failure
 * must never break what the player is doing: it is swallowed here, the request goes on.
 */
export async function recordEvent(db: Database, event: ArtEvent): Promise<void> {
  try {
    await db.insert(artEvents).values(event).onConflictDoNothing()
  } catch {
    // Lost event, not a failed request.
  }
}
