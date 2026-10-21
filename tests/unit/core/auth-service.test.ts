import { PGlite } from '@electric-sql/pglite'
import { eq } from 'drizzle-orm'
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

    expect(result).toMatchObject({ created: true, user: { username: 'Маша', country: 'RU' } })
  })

  it('signs the same user in again from the same country, whatever the letter case', async () => {
    const first = await signIn(db, { username: 'Kate', country: 'US' })
    const second = await signIn(db, { username: 'kATE', country: 'US' })

    expect(second).toMatchObject({ created: false })
    expect(second.user.id).toBe(first.user.id)
  })

  it('keeps the name as first typed', async () => {
    await signIn(db, { username: 'Oleg', country: 'KZ' })
    const again = await signIn(db, { username: 'OLEG', country: 'KZ' })

    expect(again.user.username).toBe('Oleg')
  })

  it('treats the same name in another country as another player', async () => {
    const german = await signIn(db, { username: 'Anna', country: 'DE' })
    const french = await signIn(db, { username: 'anna', country: 'FR' })

    expect(french.created).toBe(true)
    expect(french.user.id).not.toBe(german.user.id)
    const rows = await db.select().from(users).where(eq(users.usernameKey, 'anna'))
    expect(rows.map(row => row.country).sort()).toEqual(['DE', 'FR'])
  })

  it('creates one user when two first sign-ins race', async () => {
    const results = await Promise.all([
      signIn(db, { username: 'Racer', country: 'IT' }),
      signIn(db, { username: 'racer', country: 'IT' }),
      signIn(db, { username: 'RACER', country: 'IT' }),
    ])

    expect(results.filter(result => result.created)).toHaveLength(1)
  })

  it('treats compatibility forms of a name as the same name (NFKC) and stores the plain form', async () => {
    const plain = await signIn(db, { username: 'Ivan', country: 'BG' })
    // Full-width Latin letters with spaces around: what a caller that skipped the schema might pass.
    const fullWidth = await signIn(db, { username: '  Ｉｖａｎ ', country: 'BG' })

    expect(fullWidth.user.id).toBe(plain.user.id)
    expect(fullWidth.user.username).toBe('Ivan')
  })

  it('stores a display name that a caller passed unnormalized in its plain form', async () => {
    const result = await signIn(db, { username: '  Ｌｉｚａ  ', country: 'PL' })

    expect(result.user.username).toBe('Liza')
  })
})
