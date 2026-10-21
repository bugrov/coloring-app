import { eq } from 'drizzle-orm'
import { normalizeUsername, usernameKey } from '../../shared/auth/username'
import type { Database } from '../utils/db'
import { users, type UserRow } from '../db/schema'

export interface SignInInput {
  username: string
  country: string
}

export type SignInResult
  = | { ok: true, user: UserRow, created: boolean }
  /** The name belongs to someone from another country. */
    | { ok: false, reason: 'username_taken' }

/**
 * Passwordless sign-in or sign-up. A name is unique worldwide (case-insensitive);
 * its country is fixed at the first sign-in and must match afterwards.
 *
 * Only single statements: the Neon HTTP driver has no interactive transactions.
 * The insert and the unique index decide races between two first sign-ins.
 */
export async function signIn(db: Database, { username, country }: SignInInput): Promise<SignInResult> {
  // The schema normalizes already; the service does not rely on its callers to.
  const displayName = normalizeUsername(username)
  const key = usernameKey(username)
  const find = async () => (await db.select().from(users).where(eq(users.usernameKey, key)).limit(1))[0]
  const existingOutcome = (row: UserRow): SignInResult =>
    row.country === country ? { ok: true, user: row, created: false } : { ok: false, reason: 'username_taken' }

  // A returning player costs one round trip: most sign-ins find their row here.
  const existing = await find()
  if (existing) return existingOutcome(existing)

  const [created] = await db
    .insert(users)
    .values({ username: displayName, usernameKey: key, country })
    .onConflictDoNothing({ target: users.usernameKey })
    .returning()
  if (created) return { ok: true, user: created, created: true }

  // Lost a race with a concurrent first sign-in of the same name: the winner's row decides.
  const winner = await find()
  return winner ? existingOutcome(winner) : { ok: false, reason: 'username_taken' }
}
