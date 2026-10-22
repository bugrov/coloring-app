import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { describe, expect, it } from 'vitest'
import { arts } from '../../../../layers/coloring/server/db/schema'
import { seedBuiltinArts, type BuiltinArtSource } from '../../../../layers/coloring/server/services/seed'
import { artSchema } from '../../../../layers/coloring/shared/art'

const sources: BuiltinArtSource[] = [
  { key: 'octopus', title: 'Осьминог' },
  { key: 'cat', title: 'Кот' },
  { key: 'house', title: 'Дом' },
].map(art => ({ ...art, svg: readFileSync(`layers/coloring/server/assets/arts/${art.key}.svg`, 'utf8') }))

async function createDatabase() {
  const db = drizzle(new PGlite())

  await migrate(db, { migrationsFolder: 'layers/core/server/db/migrations' })

  return db
}

describe('seedBuiltinArts', () => {
  it('stores the three built-in arts as valid normalized art, first card last in insertion order', async () => {
    const db = await createDatabase()

    await seedBuiltinArts(db, sources)
    const rows = await db.select().from(arts).orderBy(arts.seq)

    expect(rows.map(row => row.builtinKey)).toEqual(['house', 'cat', 'octopus'])

    for (const row of rows) expect(artSchema.safeParse(row.data).success).toBe(true)
  })

  it('is idempotent and refreshes an existing art without moving it', async () => {
    const db = await createDatabase()

    await seedBuiltinArts(db, sources)
    const [before] = await db.select().from(arts).where(eq(arts.builtinKey, 'cat'))

    await seedBuiltinArts(db, sources.map(source => (source.key === 'cat' ? { ...source, title: 'Котик' } : source)))
    const [after] = await db.select().from(arts).where(eq(arts.builtinKey, 'cat'))

    expect(await db.select().from(arts)).toHaveLength(3)
    expect(after).toMatchObject({ id: before!.id, seq: before!.seq, title: 'Котик' })
  })

  it('refuses a source that does not convert, naming the art', async () => {
    const db = await createDatabase()

    await expect(seedBuiltinArts(db, [{ key: 'bad', title: 'Плохой', svg: '<html/>' }])).rejects.toThrow('"bad"')
  })
})
