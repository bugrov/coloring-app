import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { beforeAll, describe, expect, it } from 'vitest'
import { users } from '../../../../layers/core/server/db/schema'
import { importArt, listGallery } from '../../../../layers/coloring/server/services/arts'
import { saveHistory } from '../../../../layers/coloring/server/services/history'
import { restartArt } from '../../../../layers/coloring/server/services/progress'
import { detectThumbnailType, readThumbnail, saveThumbnail, thumbnailPathsOfArt, type ThumbnailStore } from '../../../../layers/coloring/server/services/thumbnails'
import { THUMBNAIL_MAX_BYTES } from '../../../../layers/coloring/shared/gallery'
import { convertSvg } from '../../../../layers/coloring/shared/svg'

const SQUARE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="#fff"/></svg>'
const converted = convertSvg(SQUARE)
if (!converted.ok) throw new Error('fixture SVG must convert')

/** The smallest bytes that read as each image type. */
const webp = (extra = 0) => new Uint8Array([...'RIFF'].map(c => c.charCodeAt(0)).concat([0, 0, 0, 0], [...'WEBP'].map(c => c.charCodeAt(0)), new Array(extra).fill(1)))
const png = () => new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

function memoryStore(): ThumbnailStore & { files: Map<string, { body: Uint8Array, contentType: string }> } {
  const files = new Map<string, { body: Uint8Array, contentType: string }>()
  return {
    files,
    async put(pathname, body, contentType) {
      files.set(pathname, { body, contentType })
    },
    async get(pathname) {
      const file = files.get(pathname)
      return file ? { stream: new Blob([file.body.slice().buffer]).stream(), contentType: file.contentType } : null
    },
    async remove(pathnames) {
      for (const pathname of pathnames) files.delete(pathname)
    },
  }
}

async function createDatabase() {
  const db = drizzle(new PGlite())
  await migrate(db, { migrationsFolder: 'layers/core/server/db/migrations' })
  return db
}

describe('detectThumbnailType', () => {
  it('knows WebP and PNG by their signature', () => {
    expect(detectThumbnailType(webp())).toBe('image/webp')
    expect(detectThumbnailType(png())).toBe('image/png')
  })

  it('refuses anything else, whatever the client calls it', () => {
    expect(detectThumbnailType(new TextEncoder().encode('<svg onload="alert(1)"/>'))).toBeNull()
    expect(detectThumbnailType(new TextEncoder().encode('<html></html>'))).toBeNull()
    expect(detectThumbnailType(new Uint8Array([]))).toBeNull()
    expect(detectThumbnailType(new Uint8Array([...'RIFF'].map(c => c.charCodeAt(0))))).toBeNull()
  })
})

describe('thumbnail services', () => {
  let db: Awaited<ReturnType<typeof createDatabase>>
  let counter = 0
  let anna: string
  let artId: string

  const newUser = async () => {
    counter += 1
    const [row] = await db.insert(users).values({ username: `t${counter}`, usernameKey: `t${counter}`, country: 'DE' }).returning()
    return row!.id
  }

  const started = async () => {
    anna = await newUser()
    const result = await importArt(db, anna, 'Рисунок', converted.art)
    if (!result.ok) throw new Error('import failed')
    artId = result.id
    await saveHistory(db, anna, artId, { attempt: 0, rev: 0, keep: 0, steps: [[{ type: 'fill', region: 1, color: '#e53935' }]], cursor: 1, percent: 10 })
  }

  beforeAll(async () => {
    db = await createDatabase()
  })

  it('has nothing to store a thumbnail on before the first save of the history', async () => {
    anna = await newUser()
    const result = await importArt(db, anna, 'Рисунок', converted.art)
    if (!result.ok) throw new Error('import failed')

    expect(await saveThumbnail(db, memoryStore(), anna, result.id, webp())).toEqual({ ok: false, reason: 'not_started' })
  })

  it('stores the thumbnail, serves it back with its type, and shows its time in the gallery', async () => {
    await started()
    const store = memoryStore()

    expect(await saveThumbnail(db, store, anna, artId, webp(20))).toEqual({ ok: true })

    const read = await readThumbnail(db, store, anna, artId)
    expect(read?.contentType).toBe('image/webp')
    expect(new Uint8Array(await new Response(read!.stream).arrayBuffer())).toEqual(webp(20))
    const card = (await listGallery(db, anna)).items.find(item => item.id === artId)
    expect(card?.thumbnail).toBeGreaterThan(Date.now() - 60_000)
  })

  it('refuses what is not an image or is too big, and stores nothing', async () => {
    await started()
    const store = memoryStore()

    expect(await saveThumbnail(db, store, anna, artId, new TextEncoder().encode('<svg/>'))).toEqual({ ok: false, reason: 'invalid' })
    expect(await saveThumbnail(db, store, anna, artId, webp(THUMBNAIL_MAX_BYTES))).toEqual({ ok: false, reason: 'invalid' })
    expect(store.files.size).toBe(0)
    expect(await readThumbnail(db, store, anna, artId)).toBeNull()
  })

  it('replaces the thumbnail of the same attempt instead of piling files up', async () => {
    await started()
    const store = memoryStore()

    await saveThumbnail(db, store, anna, artId, webp(1))
    await saveThumbnail(db, store, anna, artId, png())

    expect(store.files.size).toBe(1)
    expect((await readThumbnail(db, store, anna, artId))?.contentType).toBe('image/png')
  })

  it('starts over with no thumbnail: the card shows the empty art again', async () => {
    await started()
    const store = memoryStore()
    await saveThumbnail(db, store, anna, artId, webp())

    await restartArt(db, anna, artId)

    expect(await readThumbnail(db, store, anna, artId)).toBeNull()
    expect((await listGallery(db, anna)).items.find(item => item.id === artId)?.thumbnail).toBeNull()
  })

  it('does not give a player the thumbnail of someone else', async () => {
    await started()
    const store = memoryStore()
    await saveThumbnail(db, store, anna, artId, webp())
    const boris = await newUser()

    expect(await readThumbnail(db, store, boris, artId)).toBeNull()
  })

  it('names the files of every attempt of an art, to remove with it', async () => {
    await started()
    const store = memoryStore()
    await saveThumbnail(db, store, anna, artId, webp())
    await restartArt(db, anna, artId)
    await saveHistory(db, anna, artId, { attempt: 2, rev: 0, keep: 0, steps: [[{ type: 'fill', region: 1, color: '#e53935' }]], cursor: 1, percent: 10 })
    await saveThumbnail(db, store, anna, artId, webp(2))

    const paths = await thumbnailPathsOfArt(db, artId)

    expect(paths).toHaveLength(2)
    expect([...store.files.keys()].sort()).toEqual([...paths].sort())
  })
})
