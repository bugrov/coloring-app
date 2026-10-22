import { PGlite } from '@electric-sql/pglite'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { beforeAll, describe, expect, it } from 'vitest'
import { users } from '../../../../layers/core/server/db/schema'
import { appSettings, artAssignments, artEvents, arts } from '../../../../layers/coloring/server/db/schema'
import { createAdminArt, deleteAdminArt, getAdminArt, listAdminArts, setAssignments, updateAdminArt } from '../../../../layers/coloring/server/services/admin-arts'
import { getPlayer, listPlayerArts, loadPlayerArtState, searchPlayers } from '../../../../layers/coloring/server/services/admin-players'
import { loadStats } from '../../../../layers/coloring/server/services/admin-stats'
import { artIsVisible, findVisibleArt, listGallery } from '../../../../layers/coloring/server/services/arts'
import { recordEvent } from '../../../../layers/coloring/server/services/events'
import { saveHistory } from '../../../../layers/coloring/server/services/history'
import { restartArt } from '../../../../layers/coloring/server/services/progress'
import { getPaintedTolerance, getPalette, setPaintedTolerance, setPalette } from '../../../../layers/coloring/server/services/settings'
import { DEFAULT_PAINTED_TOLERANCE } from '../../../../layers/coloring/shared/admin'
import { PALETTE } from '../../../../layers/coloring/shared/palette'
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

describe('admin and analytics services', () => {
  let db: Awaited<ReturnType<typeof createDatabase>>
  let counter = 0

  const newUser = async (country = 'DE', name = `p${++counter}`) => {
    const [row] = await db.insert(users).values({ username: name, usernameKey: name.toLowerCase(), country }).returning()

    return row!.id
  }
  const newArt = async (status: 'draft' | 'published' | 'hidden' = 'published') => {
    const id = await createAdminArt(db, `Арт ${++counter}`, ART)

    await updateAdminArt(db, id, { status })

    return id
  }

  beforeAll(async () => {
    db = await createDatabase()
  })

  describe('who sees which art', () => {
    it('keeps a draft and a hidden art from players, shows a published one', async () => {
      const player = await newUser()
      const draft = await newArt('draft')
      const hidden = await newArt('hidden')
      const published = await newArt('published')

      expect(await artIsVisible(db, player, draft)).toBe(false)
      expect(await artIsVisible(db, player, hidden)).toBe(false)
      expect(await artIsVisible(db, player, published)).toBe(true)
      expect(await findVisibleArt(db, player, draft)).toBeNull()
      const gallery = (await listGallery(db, player)).items.map(item => item.id)

      expect(gallery).toContain(published)
      expect(gallery).not.toContain(draft)
      expect(gallery).not.toContain(hidden)
    })

    it('hides a built-in art the administrator hid, and shows it again when published', async () => {
      const player = await newUser()
      const [builtin] = await db.insert(arts).values({ source: 'builtin', builtinKey: `b${++counter}`, title: 'Встроенный', data: ART }).returning()

      expect(await artIsVisible(db, player, builtin!.id)).toBe(true)
      await updateAdminArt(db, builtin!.id, { status: 'hidden' })
      expect(await artIsVisible(db, player, builtin!.id)).toBe(false)
      await updateAdminArt(db, builtin!.id, { status: 'published' })
      expect(await artIsVisible(db, player, builtin!.id)).toBe(true)
    })

    it('shows an assigned art only to the countries and players listed', async () => {
      const german = await newUser('DE')
      const french = await newUser('FR')
      const chosen = await newUser('IT')
      const id = await newArt()

      await setAssignments(db, id, { countries: ['DE'], players: [chosen] })

      expect(await artIsVisible(db, german, id)).toBe(true)
      expect(await artIsVisible(db, chosen, id)).toBe(true)
      expect(await artIsVisible(db, french, id)).toBe(false)
    })

    it('opens the art to everyone again when the assignments are cleared', async () => {
      const french = await newUser('FR')
      const id = await newArt()

      await setAssignments(db, id, { countries: ['DE'], players: [] })
      expect(await artIsVisible(db, french, id)).toBe(false)

      await setAssignments(db, id, { countries: [], players: [] })

      expect(await artIsVisible(db, french, id)).toBe(true)
    })

    it('never shows a player the import of another player', async () => {
      const owner = await newUser()
      const other = await newUser()
      const [mine] = await db.insert(arts).values({ source: 'user', ownerId: owner, title: 'Мой', data: ART }).returning()

      expect(await artIsVisible(db, owner, mine!.id)).toBe(true)
      expect(await artIsVisible(db, other, mine!.id)).toBe(false)
    })
  })

  describe('assignments', () => {
    it('replaces the list and keeps what stays', async () => {
      const player = await newUser()
      const id = await newArt()

      await setAssignments(db, id, { countries: ['DE', 'FR'], players: [player] })
      await setAssignments(db, id, { countries: ['FR', 'IT'], players: [] })

      const art = (await listAdminArts(db)).find(entry => entry.id === id)!

      expect([...art.assignedCountries].sort()).toEqual(['FR', 'IT'])
      expect(art.assignedPlayers).toEqual([])
      expect(await db.select().from(artAssignments).where(eq(artAssignments.artId, id))).toHaveLength(2)
    })

    it('refuses a list with a player that does not exist and changes nothing: a restricted art must not become public', async () => {
      const player = await newUser('FR')
      const id = await newArt()

      await setAssignments(db, id, { countries: ['DE'], players: [] })

      const result = await setAssignments(db, id, { countries: [], players: ['00000000-0000-4000-8000-000000000000'] })

      expect(result).toBe('unknown_player')
      expect((await listAdminArts(db)).find(entry => entry.id === id)!.assignedCountries).toEqual(['DE'])
      expect(await artIsVisible(db, player, id)).toBe(false)
    })

    it('lists the assigned players with their names', async () => {
      const player = await newUser('SE', 'Greta')
      const id = await newArt()

      await setAssignments(db, id, { countries: [], players: [player] })

      const art = (await listAdminArts(db)).find(entry => entry.id === id)!

      expect(art.assignedPlayers).toEqual([{ id: player, username: 'Greta', country: 'SE' }])
    })

    it('refuses an art that is not the administrator\'s', async () => {
      const owner = await newUser()
      const [mine] = await db.insert(arts).values({ source: 'user', ownerId: owner, title: 'Мой', data: ART }).returning()

      expect(await setAssignments(db, mine!.id, { countries: ['DE'], players: [] })).toBe('not_found')
      expect(await updateAdminArt(db, mine!.id, { status: 'hidden' })).toBe('not_found')
      expect(await getAdminArt(db, mine!.id)).toBeNull()
    })
  })

  describe('admin arts', () => {
    it('renames an admin art but not a built-in one: the seed owns that title', async () => {
      const mine = await createAdminArt(db, 'Старое', ART)
      const [builtin] = await db.insert(arts).values({ source: 'builtin', builtinKey: `t${++counter}`, title: 'Встроенный', data: ART }).returning()

      expect(await updateAdminArt(db, mine, { title: 'Новое' })).toBe('ok')
      expect((await getAdminArt(db, mine))?.title).toBe('Новое')
      expect(await updateAdminArt(db, builtin!.id, { title: 'Другое' })).toBe('title_locked')
      expect(await updateAdminArt(db, builtin!.id, { status: 'hidden' })).toBe('ok')
      expect((await getAdminArt(db, builtin!.id))?.title).toBe('Встроенный')
    })

    it('stores an upload as a draft, and only admin arts can be deleted', async () => {
      const id = await createAdminArt(db, 'Загруженный', ART)
      const [builtin] = await db.insert(arts).values({ source: 'builtin', builtinKey: `d${++counter}`, title: 'Встроенный', data: ART }).returning()

      expect((await getAdminArt(db, id))?.status).toBe('draft')
      expect(await deleteAdminArt(db, builtin!.id)).toBe(false)
      expect(await deleteAdminArt(db, id)).toBe(true)
      expect(await getAdminArt(db, id)).toBeNull()
    })

    it('does not list a player\'s import', async () => {
      const owner = await newUser()
      const [mine] = await db.insert(arts).values({ source: 'user', ownerId: owner, title: 'Чужой импорт', data: ART }).returning()

      expect((await listAdminArts(db)).some(entry => entry.id === mine!.id)).toBe(false)
    })
  })

  describe('events', () => {
    it('counts start and complete once per attempt, and open every time', async () => {
      const player = await newUser()
      const id = await newArt()
      const event = { userId: player, artId: id, attempt: 1, country: 'DE' }

      await recordEvent(db, { ...event, type: 'open' })
      await recordEvent(db, { ...event, type: 'open' })
      await recordEvent(db, { ...event, type: 'start' })
      await recordEvent(db, { ...event, type: 'start' })
      await recordEvent(db, { ...event, type: 'complete' })
      await recordEvent(db, { ...event, type: 'complete' })
      await recordEvent(db, { ...event, attempt: 2, type: 'start' })

      const rows = await db.select().from(artEvents).where(eq(artEvents.artId, id))

      expect(rows.filter(row => row.type === 'open')).toHaveLength(2)
      expect(rows.filter(row => row.type === 'start')).toHaveLength(2)
      expect(rows.filter(row => row.type === 'complete')).toHaveLength(1)
    })

    it('never throws: a lost event must not fail the request', async () => {
      await expect(recordEvent(db, { type: 'open', userId: '00000000-0000-4000-8000-000000000000', artId: '00000000-0000-4000-8000-000000000001', attempt: 0, country: 'DE' })).resolves.toBeUndefined()
    })

    it('records a restart as an event of the new attempt', async () => {
      const player = await newUser()
      const id = await newArt()

      await saveHistory(db, player, id, { attempt: 0, rev: 0, keep: 0, steps: [[{ type: 'fill', region: 1, color: '#e53935' }]], cursor: 1, percent: 10 })

      const restarted = await restartArt(db, player, id)

      expect(restarted).toEqual({ ok: true, attempt: 2, created: true })
      expect(await restartArt(db, player, id)).toEqual({ ok: true, attempt: 2, created: false })
    })
  })

  describe('statistics', () => {
    it('counts the period per type, per art, per day and per country', async () => {
      const german = await newUser('DE')
      const french = await newUser('FR')
      const id = await newArt()
      const base = { artId: id }

      await recordEvent(db, { ...base, userId: german, attempt: 1, country: 'DE', type: 'open' })
      await recordEvent(db, { ...base, userId: german, attempt: 1, country: 'DE', type: 'start' })
      await recordEvent(db, { ...base, userId: french, attempt: 1, country: 'FR', type: 'open' })
      await recordEvent(db, { ...base, userId: french, attempt: 1, country: 'FR', type: 'open' })

      const stats = await loadStats(db, 7)

      const art = stats.arts.find(entry => entry.id === id)!

      expect(art).toMatchObject({ opens: 3, starts: 1, completes: 0, restarts: 0 })
      expect(stats.totals.opens).toBeGreaterThanOrEqual(3)
      expect(stats.daily).toHaveLength(7)
      expect(stats.daily.at(-1)!.opens).toBeGreaterThanOrEqual(3)
      expect(stats.daily[0]!.day < stats.daily.at(-1)!.day).toBe(true)
      expect(stats.countries.find(entry => entry.country === 'FR')).toMatchObject({ players: 1 })
    })

    it('leaves out events older than the period', async () => {
      const player = await newUser()
      const id = await newArt()

      await db.insert(artEvents).values({ type: 'open', userId: player, artId: id, attempt: 0, country: 'DE', createdAt: new Date(Date.now() - 40 * 86_400_000) })

      const stats = await loadStats(db, 7)

      expect(stats.arts.some(entry => entry.id === id)).toBe(false)
    })

    it('shows the counters of the arts in the admin list', async () => {
      const player = await newUser()
      const id = await newArt()

      await recordEvent(db, { type: 'open', userId: player, artId: id, attempt: 0, country: 'DE' })
      await recordEvent(db, { type: 'complete', userId: player, artId: id, attempt: 1, country: 'DE' })

      const art = (await listAdminArts(db)).find(entry => entry.id === id)!

      expect(art).toMatchObject({ opens: 1, starts: 0, completes: 1 })
    })
  })

  describe('players', () => {
    it('finds players by the beginning of their name, ignoring case, and takes % and _ as typed', async () => {
      await newUser('DE', 'Stefan')
      await newUser('DE', 'Steffi_x')
      await newUser('DE', 'Stexy')

      expect((await searchPlayers(db, 'STEF')).map(player => player.username).sort()).toEqual(['Stefan', 'Steffi_x'])
      expect((await searchPlayers(db, 'Steffi_')).map(player => player.username)).toEqual(['Steffi_x'])
      expect(await searchPlayers(db, '%')).toEqual([])
    })

    it('shows the attempts of a player and replays the history of one of them', async () => {
      const player = await newUser()
      const id = await newArt()

      await saveHistory(db, player, id, { attempt: 0, rev: 0, keep: 0, steps: [[{ type: 'fill', region: 1, color: '#e53935' }]], cursor: 1, percent: 40 })
      await restartArt(db, player, id)
      await saveHistory(db, player, id, { attempt: 2, rev: 0, keep: 0, steps: [[{ type: 'fill', region: 1, color: '#43a047' }], [{ type: 'clear', region: 1 }]], cursor: 2, percent: 0 })

      const listed = (await listPlayerArts(db, player)).find(entry => entry.artId === id)!

      expect(listed.attempts.map(attempt => [attempt.attempt, attempt.percent, attempt.steps]).sort()).toEqual([[1, 40, 1], [2, 0, 2]])

      const first = await loadPlayerArtState(db, player, id, 1)

      expect(first?.history).toMatchObject({ attempt: 1, cursor: 1 })
      expect(first?.history.steps).toHaveLength(1)
      const latest = await loadPlayerArtState(db, player, id)

      expect(latest?.history.attempt).toBe(2)
    })

    it('has nothing to show for an art the player never started, or an attempt that does not exist', async () => {
      const player = await newUser()
      const id = await newArt()

      expect(await loadPlayerArtState(db, player, id)).toBeNull()
      await saveHistory(db, player, id, { attempt: 0, rev: 0, keep: 0, steps: [[{ type: 'fill', region: 1, color: '#e53935' }]], cursor: 1, percent: 10 })
      expect(await loadPlayerArtState(db, player, id, 5)).toBeNull()
      expect(await getPlayer(db, '00000000-0000-4000-8000-000000000000')).toBeNull()
    })
  })

  describe('settings', () => {
    it('answers the default until the administrator sets a value, then the value', async () => {
      await db.delete(appSettings)
      expect(await getPaintedTolerance(db)).toBe(DEFAULT_PAINTED_TOLERANCE)

      await setPaintedTolerance(db, 0.8)
      expect(await getPaintedTolerance(db)).toBe(0.8)
      await setPaintedTolerance(db, 0.9)
      expect(await getPaintedTolerance(db)).toBe(0.9)
    })

    it('answers the standard palette until the administrator sets one, then that one', async () => {
      await db.delete(appSettings)
      expect(await getPalette(db)).toEqual(PALETTE)

      const custom = PALETTE.map((color, index) => (index === 0 ? { hex: '#123456', name: 'Мой цвет' } : { ...color }))

      await setPalette(db, custom)

      expect(await getPalette(db)).toEqual(custom)
    })

    it('falls back to the standard palette for a stored one that is broken', async () => {
      await db.delete(appSettings)
      await db.insert(appSettings).values({ key: 'palette', value: [{ hex: 'red', name: 'x' }] })

      expect(await getPalette(db)).toEqual(PALETTE)
    })

    it('falls back to the default for a value that makes no sense', async () => {
      await db.insert(appSettings).values({ key: 'paintedTolerance', value: 'abc' }).onConflictDoUpdate({ target: appSettings.key, set: { value: 'abc' } })
      expect(await getPaintedTolerance(db)).toBe(DEFAULT_PAINTED_TOLERANCE)

      await db.update(appSettings).set({ value: 3 }).where(eq(appSettings.key, 'paintedTolerance'))
      expect(await getPaintedTolerance(db)).toBe(DEFAULT_PAINTED_TOLERANCE)
    })
  })
})
