import { eq } from 'drizzle-orm'
import { usernameKey } from '../../shared/auth'
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
  const key = usernameKey(username)

  const [created] = await db
    .insert(users)
    .values({ username, usernameKey: key, country })
    .onConflictDoNothing({ target: users.usernameKey })
    .returning()
  if (created) return { ok: true, user: created, created: true }

  const [existing] = await db.select().from(users).where(eq(users.usernameKey, key)).limit(1)
  if (!existing || existing.country !== country) return { ok: false, reason: 'username_taken' }
  return { ok: true, user: existing, created: false }
}
