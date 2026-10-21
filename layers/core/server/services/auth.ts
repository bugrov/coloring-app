import { and, eq } from 'drizzle-orm'
import { normalizeUsername, usernameKey } from '../../shared/auth/username'
import type { Database } from '../utils/db'
import { users, type UserRow } from '../db/schema'

export interface SignInInput {
  username: string
  country: string
}

export interface SignInResult {
  user: UserRow
  created: boolean
}

/**
 * Passwordless sign-in or sign-up. A player is the pair (name, country): the name is compared
 * case-insensitively, and the same name in another country is another player.
 *
 * Only single statements: the Neon HTTP driver has no interactive transactions.
 * The insert and the unique index decide races between two first sign-ins.
 */
export async function signIn(db: Database, { username, country }: SignInInput): Promise<SignInResult> {
  // The schema normalizes already; the service does not rely on its callers to.
  const displayName = normalizeUsername(username)
  const key = usernameKey(username)
  const find = async () => (await db
    .select()
    .from(users)
    .where(and(eq(users.usernameKey, key), eq(users.country, country)))
    .limit(1))[0]

  // A returning player costs one round trip: most sign-ins find their row here.
  const existing = await find()
  if (existing) return { user: existing, created: false }

  const [created] = await db
    .insert(users)
    .values({ username: displayName, usernameKey: key, country })
    .onConflictDoNothing({ target: [users.usernameKey, users.country] })
    .returning()
  if (created) return { user: created, created: true }

  // Lost a race with a concurrent first sign-in of the same player: the winner's row is theirs too.
  const winner = await find()
  if (!winner) throw new Error('sign-in found no row after a unique conflict')
  return { user: winner, created: false }
}
