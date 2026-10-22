import { PGlite } from '@electric-sql/pglite'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { beforeAll, describe, expect, it } from 'vitest'
import { users } from '../../../../layers/core/server/db/schema'
import { arts, historySteps, progress } from '../../../../layers/coloring/server/db/schema'
import { deleteImport, importArt, listGallery } from '../../../../layers/coloring/server/services/arts'
import { HistoryLog } from '../../../../layers/coloring/shared/history'
import { loadHistory, saveHistory } from '../../../../layers/coloring/server/services/history'
import { restartArt } from '../../../../layers/coloring/server/services/progress'
import type { HistoryStep, SaveHistoryRequest } from '../../../../layers/coloring/shared'
import { convertSvg } from '../../../../layers/coloring/shared/svg'

const SQUARE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="#fff"/></svg>'
const converted = convertSvg(SQUARE)
if (!converted.ok) throw new Error('fixture SVG must convert')

const step = (region: number): HistoryStep => [{ type: 'fill', region, color: '#e53935' }]
const save = (patch: Partial<SaveHistoryRequest> & Pick<SaveHistoryRequest, 'keep' | 'steps'>): SaveHistoryRequest => ({
  attempt: 1,
  rev: 1,
  cursor: patch.keep + patch.steps.length,
  percent: 0,
  ...patch,
})

async function createDatabase() {
  const db = drizzle(new PGlite())
  await migrate(db, { migrationsFolder: 'layers/core/server/db/migrations' })
  return db
}

describe('history services', () => {
  let db: Awaited<ReturnType<typeof createDatabase>>
  let counter = 0
  let anna: string
  let artId: string

  const newUser = async () => {
    counter += 1
    const [row] = await db.insert(users).values({ username: `h${counter}`, usernameKey: `h${counter}`, country: 'DE' }).returning()
    return row!.id
  }

  const newArt = async (owner: string) => {
    const result = await importArt(db, owner, `Рисунок ${counter}`, converted.art)
    if (!result.ok) throw new Error('import failed')
    return result.id
  }

  beforeAll(async () => {
    db = await createDatabase()
  })

  /** Stored step rows of the current art, whatever the attempt. */
  const storedSteps = () => db
    .select({ seq: historySteps.seq, attempt: progress.attempt })
    .from(historySteps)
    .innerJoin(progress, eq(progress.id, historySteps.progressId))
    .where(eq(progress.artId, artId))

  const fresh = async () => {
    anna = await newUser()
    artId = await newArt(anna)
  }

  it('is empty before the first attempt', async () => {
    await fresh()

    expect(await loadHistory(db, anna, artId)).toEqual({ attempt: 0, rev: 0, cursor: 0, steps: [] })
  })

  it('creates the attempt on the first save and gives the steps back in order with the cursor', async () => {
    await fresh()

    const result = await saveHistory(db, anna, artId, save({ attempt: 0, rev: 0, keep: 0, steps: [step(1), step(2), step(3)], cursor: 2, percent: 40 }))

    expect(result).toEqual({ ok: true, attempt: 1, rev: 1 })
    expect(await loadHistory(db, anna, artId)).toEqual({ attempt: 1, rev: 1, cursor: 2, steps: [step(1), step(2), step(3)] })
  })

  it('appends to the stored steps and moves the cursor alone when no steps come', async () => {
    await fresh()
    await saveHistory(db, anna, artId, save({ attempt: 0, rev: 0, keep: 0, steps: [step(1)] }))

    await saveHistory(db, anna, artId, save({ rev: 1, keep: 1, steps: [step(2)] }))
    await saveHistory(db, anna, artId, save({ rev: 2, keep: 2, steps: [], cursor: 1 }))

    expect(await loadHistory(db, anna, artId)).toEqual({ attempt: 1, rev: 3, cursor: 1, steps: [step(1), step(2)] })
  })

  it('replaces the tail after `keep`: the redo branch is gone', async () => {
    await fresh()
    await saveHistory(db, anna, artId, save({ attempt: 0, rev: 0, keep: 0, steps: [step(1), step(2), step(3)] }))

    await saveHistory(db, anna, artId, save({ rev: 1, keep: 1, steps: [step(9)] }))

    const history = await loadHistory(db, anna, artId)
    expect(history.steps).toEqual([step(1), step(9)])
    expect(history.cursor).toBe(2)
    expect((await storedSteps()).map(row => row.seq).sort()).toEqual([1, 2])
  })

  it('refuses a save built on an outdated revision and leaves everything as it was', async () => {
    await fresh()
    await saveHistory(db, anna, artId, save({ attempt: 0, rev: 0, keep: 0, steps: [step(1)] }))

    const stale = await saveHistory(db, anna, artId, save({ rev: 0, keep: 1, steps: [step(2)] }))

    expect(stale).toEqual({ ok: false, reason: 'conflict' })
    expect(await loadHistory(db, anna, artId)).toMatchObject({ rev: 1, steps: [step(1)] })
  })

  it('lets exactly one of two saves on the same revision through', async () => {
    await fresh()
    await saveHistory(db, anna, artId, save({ attempt: 0, rev: 0, keep: 0, steps: [step(1)] }))

    const [first, second] = await Promise.all([
      saveHistory(db, anna, artId, save({ rev: 1, keep: 1, steps: [step(2)] })),
      saveHistory(db, anna, artId, save({ rev: 1, keep: 1, steps: [step(3)] })),
    ])

    expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1)
    const history = await loadHistory(db, anna, artId)
    expect(history.steps).toHaveLength(2)
    expect(history.rev).toBe(2)
  })

  it('refuses a save that would leave a gap, or whose attempt is not the latest', async () => {
    await fresh()
    await saveHistory(db, anna, artId, save({ attempt: 0, rev: 0, keep: 0, steps: [step(1)] }))

    expect(await saveHistory(db, anna, artId, save({ rev: 1, keep: 5, steps: [step(2)] }))).toEqual({ ok: false, reason: 'conflict' })
    expect(await saveHistory(db, anna, artId, save({ attempt: 2, rev: 1, keep: 1, steps: [step(2)] }))).toEqual({ ok: false, reason: 'conflict' })
    expect(await saveHistory(db, anna, artId, save({ attempt: 0, rev: 0, keep: 0, steps: [step(2)] }))).toEqual({ ok: false, reason: 'conflict' })
  })

  it('refuses a save for an art that was never started with an attempt the client invented', async () => {
    await fresh()

    expect(await saveHistory(db, anna, artId, save({ attempt: 3, rev: 1, keep: 0, steps: [step(1)] }))).toEqual({ ok: false, reason: 'conflict' })
    expect(await db.select().from(progress).where(eq(progress.artId, artId))).toHaveLength(0)
  })

  it('shows the saved percent in the gallery', async () => {
    await fresh()

    await saveHistory(db, anna, artId, save({ attempt: 0, rev: 0, keep: 0, steps: [step(1)], percent: 100 }))

    const item = (await listGallery(db, anna)).items.find(entry => entry.id === artId)
    expect(item).toMatchObject({ percent: 100, completed: true, attempt: 1 })
  })

  it('keeps one player\'s steps away from another player', async () => {
    await fresh()
    const boris = await newUser()
    await saveHistory(db, anna, artId, save({ attempt: 0, rev: 0, keep: 0, steps: [step(1)] }))

    expect(await loadHistory(db, boris, artId)).toMatchObject({ attempt: 0, steps: [] })
  })

  it('starts over even when the stroke was too faint to count as painted', async () => {
    await fresh()
    await saveHistory(db, anna, artId, save({ attempt: 0, rev: 0, keep: 0, steps: [step(1)], percent: 0 }))

    const restarted = await restartArt(db, anna, artId)

    expect(restarted).toEqual({ ok: true, attempt: 2, created: true })
    expect(await loadHistory(db, anna, artId)).toEqual({ attempt: 2, rev: 0, cursor: 0, steps: [] })
    // The first attempt keeps its steps for analytics and the admin.
    expect(await storedSteps()).toEqual([{ seq: 1, attempt: 1 }])
  })

  it('saves into the new attempt after a restart, and a stale client gets a conflict', async () => {
    await fresh()
    await saveHistory(db, anna, artId, save({ attempt: 0, rev: 0, keep: 0, steps: [step(1)], percent: 10 }))
    await restartArt(db, anna, artId)

    expect(await saveHistory(db, anna, artId, save({ attempt: 1, rev: 1, keep: 1, steps: [step(2)] }))).toEqual({ ok: false, reason: 'conflict' })
    expect(await saveHistory(db, anna, artId, save({ attempt: 2, rev: 0, keep: 0, steps: [step(5)] }))).toEqual({ ok: true, attempt: 2, rev: 1 })
  })

  it('hands steps back in jsonb key order, and the client still recognises them as its own', async () => {
    await fresh()
    const stroke: HistoryStep = [{ type: 'stroke', region: 1, tool: 'brush', color: '#e53935', width: 40, points: [1, 2, 3, 4] }]
    const log = new HistoryLog({ attempt: 0, rev: 0, cursor: 0, steps: [] })
    log.push(stroke)
    log.push(step(2))
    const request = log.nextSave(0)!
    await saveHistory(db, anna, artId, request)

    const stored = await loadHistory(db, anna, artId)

    // Postgres orders the keys of a jsonb object itself: the text differs from what the editor sent.
    expect(JSON.stringify(stored.steps[0])).not.toBe(JSON.stringify(stroke))
    log.failed()
    expect(log.reconcile(stored)).toEqual({ rebuild: false, merged: false })
    expect(log.length).toBe(2)
  })

  it('removes the steps with the art', async () => {
    await fresh()
    await saveHistory(db, anna, artId, save({ attempt: 0, rev: 0, keep: 0, steps: [step(1), step(2)] }))

    await deleteImport(db, anna, artId)

    expect(await db.select().from(arts).where(eq(arts.id, artId))).toHaveLength(0)
    expect(await storedSteps()).toHaveLength(0)
  })
})
