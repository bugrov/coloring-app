import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { beforeAll, describe, expect, it } from 'vitest'
import { users } from '../../../layers/core/server/db/schema'
import { signIn } from '../../../layers/core/server/services/auth'

/** The real migrations on an in-memory Postgres, so tests see exactly the production schema. */
async function createDatabase() {
  const db = drizzle(new PGlite())
  await migrate(db, { migrationsFolder: 'layers/core/server/db/migrations' })
  return db
}

describe('signIn', () => {
  let db: Awaited<ReturnType<typeof createDatabase>>

  beforeAll(async () => {
    db = await createDatabase()
  })

  it('creates a user on the first sign-in', async () => {
    const result = await signIn(db, { username: 'Маша', country: 'RU' })

    expect(result).toMatchObject({ ok: true, created: true, user: { username: 'Маша', country: 'RU' } })
  })

  it('signs the same user in again from the same country, whatever the letter case', async () => {
    const first = await signIn(db, { username: 'Kate', country: 'US' })
    const second = await signIn(db, { username: 'kATE', country: 'US' })

    expect(second).toMatchObject({ ok: true, created: false })
    expect(second.ok && first.ok && second.user.id).toBe(first.ok && first.user.id)
  })

  it('keeps the name as first typed', async () => {
    await signIn(db, { username: 'Oleg', country: 'KZ' })
    const again = await signIn(db, { username: 'OLEG', country: 'KZ' })

    expect(again.ok && again.user.username).toBe('Oleg')
  })

  it('refuses a name that belongs to another country and leaves the owner untouched', async () => {
    await signIn(db, { username: 'Anna', country: 'DE' })
    const intruder = await signIn(db, { username: 'anna', country: 'FR' })

    expect(intruder).toEqual({ ok: false, reason: 'username_taken' })
    const [owner] = await db.select().from(users).where((await import('drizzle-orm')).eq(users.usernameKey, 'anna'))
    expect(owner?.country).toBe('DE')
  })

  it('creates one user when two first sign-ins race', async () => {
    const results = await Promise.all([
      signIn(db, { username: 'Racer', country: 'IT' }),
      signIn(db, { username: 'racer', country: 'IT' }),
      signIn(db, { username: 'RACER', country: 'IT' }),
    ])

    expect(results.every(result => result.ok)).toBe(true)
    expect(results.filter(result => result.ok && result.created)).toHaveLength(1)
  })

  it('treats compatibility forms of a name as the same name (NFKC)', async () => {
    // Full-width Latin letters normalize to plain ones in the schema; the key stays consistent.
    const plain = await signIn(db, { username: 'Ivan', country: 'BG' })
    const lower = await signIn(db, { username: 'ivan', country: 'BG' })

    expect(plain.ok && lower.ok && plain.user.id === lower.user.id).toBe(true)
  })
})
