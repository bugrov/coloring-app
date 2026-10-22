import { PGlite } from '@electric-sql/pglite'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { beforeAll, describe, expect, it } from 'vitest'
import { users } from '../../../../layers/core/server/db/schema'
import { arts, progress } from '../../../../layers/coloring/server/db/schema'
import { deleteImport, findVisibleArt, importArt, listGallery } from '../../../../layers/coloring/server/services/arts'
import { restartArt } from '../../../../layers/coloring/server/services/progress'
import { GALLERY_PAGE_SIZE, IMPORT_LIMIT } from '../../../../layers/coloring/shared/gallery'
import { convertSvg } from '../../../../layers/coloring/shared/svg'

const SQUARE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="#fff"/></svg>'
const converted = convertSvg(SQUARE)

if (!converted.ok) throw new Error('fixture SVG must convert')
const ART = converted.art

async function createDatabase() {
  const db = drizzle(new PGlite())

  await migrate(db, { migrationsFolder: 'layers/core/server/db/migrations' })

  return db
}

describe('gallery services', () => {
  let db: Awaited<ReturnType<typeof createDatabase>>
  let anna: string
  let boris: string
  let counter = 0

  const newUser = async () => {
    counter += 1
    const [row] = await db.insert(users).values({ username: `u${counter}`, usernameKey: `u${counter}`, country: 'DE' }).returning()

    return row!.id
  }

  beforeAll(async () => {
    db = await createDatabase()
    anna = await newUser()
    boris = await newUser()
  })

  it('lists built-in arts for everyone, newest first, with no progress', async () => {
    await db.insert(arts).values([
      { source: 'builtin', builtinKey: 'house', title: 'Дом', data: ART },
      { source: 'builtin', builtinKey: 'octopus', title: 'Осьминог', data: ART },
    ])

    const page = await listGallery(db, anna)

    expect(page.items.map(item => item.title)).toEqual(['Осьминог', 'Дом'])
    expect(page.items[0]).toMatchObject({ source: 'builtin', percent: 0, attempt: 0, completed: false })
    expect(page.nextCursor).toBeNull()
  })

  it('keeps imports private to their owner', async () => {
    const result = await importArt(db, anna, 'Тайный', ART)

    if (!result.ok) throw new Error('import failed')

    expect((await listGallery(db, anna)).items.map(item => item.title)).toContain('Тайный')
    expect((await listGallery(db, boris)).items.map(item => item.title)).not.toContain('Тайный')
    expect(await findVisibleArt(db, boris, result.id)).toBeNull()
    expect(await findVisibleArt(db, anna, result.id)).not.toBeNull()
  })

  it('pages through everything exactly once by keyset', async () => {
    const reader = await newUser()

    for (let index = 0; index < IMPORT_LIMIT; index += 1) {
      expect((await importArt(db, reader, `Арт ${index}`, ART)).ok).toBe(true)
    }

    const seen: string[] = []
    let cursor: number | undefined
    let pages = 0

    do {
      const page = await listGallery(db, reader, cursor)

      expect(page.items.length).toBeLessThanOrEqual(GALLERY_PAGE_SIZE)
      seen.push(...page.items.map(item => item.id))
      cursor = page.nextCursor ? Number(page.nextCursor) : undefined
      pages += 1
    } while (cursor !== undefined)

    // 20 imports + 2 built-ins, 12 per page.
    expect(seen).toHaveLength(IMPORT_LIMIT + 2)
    expect(new Set(seen).size).toBe(seen.length)
    expect(pages).toBe(2)
  })

  it('refuses an import beyond the limit', async () => {
    const full = await newUser()

    for (let index = 0; index < IMPORT_LIMIT; index += 1) await importArt(db, full, `Арт ${index}`, ART)

    expect(await importArt(db, full, 'Лишний', ART)).toEqual({ ok: false, reason: 'limit_reached' })
  })

  it('shows the latest attempt on the card and keeps the old one', async () => {
    const player = await newUser()
    const imported = await importArt(db, player, 'С прогрессом', ART)

    if (!imported.ok) throw new Error('import failed')
    await db.insert(progress).values({ userId: player, artId: imported.id, attempt: 1, percent: 60 })

    expect((await listGallery(db, player)).items[0]).toMatchObject({ percent: 60, attempt: 1 })

    expect(await restartArt(db, player, imported.id)).toEqual({ ok: true, attempt: 2, created: true })
    expect((await listGallery(db, player)).items[0]).toMatchObject({ percent: 0, attempt: 2 })
    const attempts = await db.select().from(progress).where(eq(progress.artId, imported.id))

    expect(attempts.map(row => row.attempt).sort()).toEqual([1, 2])
  })

  it('does not pile up empty attempts when restarted again', async () => {
    const player = await newUser()
    const imported = await importArt(db, player, 'Пустой', ART)

    if (!imported.ok) throw new Error('import failed')
    await db.insert(progress).values({ userId: player, artId: imported.id, attempt: 1, percent: 30 })

    expect(await restartArt(db, player, imported.id)).toEqual({ ok: true, attempt: 2, created: true })
    expect(await restartArt(db, player, imported.id)).toEqual({ ok: true, attempt: 2, created: false })
    expect(await db.select().from(progress).where(eq(progress.artId, imported.id))).toHaveLength(2)
  })

  it('does not show another player\'s progress', async () => {
    const owner = await newUser()
    const other = await newUser()
    const [octopus] = await db.select().from(arts).where(eq(arts.builtinKey, 'octopus'))

    await db.insert(progress).values({ userId: owner, artId: octopus!.id, attempt: 1, percent: 80 })

    const mine = (await listGallery(db, other)).items.find(item => item.id === octopus!.id)

    expect(mine).toMatchObject({ percent: 0, attempt: 0 })
  })

  it('has nothing to restart before the first attempt', async () => {
    const player = await newUser()
    const imported = await importArt(db, player, 'Новый', ART)

    if (!imported.ok) throw new Error('import failed')

    expect(await restartArt(db, player, imported.id)).toEqual({ ok: false, reason: 'not_started' })
  })

  it('deletes only the owner\'s own import, with its attempts', async () => {
    const owner = await newUser()
    const stranger = await newUser()
    const imported = await importArt(db, owner, 'Удалить', ART)

    if (!imported.ok) throw new Error('import failed')
    await db.insert(progress).values({ userId: owner, artId: imported.id })

    expect(await deleteImport(db, stranger, imported.id)).toBe(false)
    expect(await findVisibleArt(db, owner, imported.id)).not.toBeNull()

    expect(await deleteImport(db, owner, imported.id)).toBe(true)
    expect(await findVisibleArt(db, owner, imported.id)).toBeNull()
    expect(await db.select().from(progress).where(eq(progress.artId, imported.id))).toEqual([])
  })

  it('never deletes a built-in art', async () => {
    const [octopus] = await db.select().from(arts).where(eq(arts.builtinKey, 'octopus'))

    expect(await deleteImport(db, anna, octopus!.id)).toBe(false)
    expect(await findVisibleArt(db, anna, octopus!.id)).not.toBeNull()
  })
})
