import { describe, expect, it } from 'vitest'
import { HistoryLog, MAX_BATCH_STEPS, UNDO_LIMIT } from '../../../layers/coloring/shared/history'
import type { HistoryState, HistoryStep } from '../../../layers/coloring/shared'

const step = (region: number): HistoryStep => [{ type: 'fill', region, color: '#e53935' }]
const state = (regions: number[], cursor = regions.length, rev = 1): HistoryState => ({ attempt: 1, rev, cursor, steps: regions.map(step) })

describe('HistoryLog: undo and redo', () => {
  it('moves the cursor and stops at both ends', () => {
    const log = new HistoryLog()
    expect(log.canUndo).toBe(false)
    log.push(step(1))
    log.push(step(2))

    expect(log.undo()).toBe(true)
    expect(log.cursor).toBe(1)
    expect(log.canRedo).toBe(true)
    expect(log.redo()).toBe(true)
    expect(log.redo()).toBe(false)
    expect(log.undo() && log.undo()).toBe(true)
    expect(log.undo()).toBe(false)
  })

  it('cuts the redo branch when a new step follows an undo', () => {
    const log = new HistoryLog()
    log.push(step(1))
    log.push(step(2))
    log.undo()
    log.push(step(3))

    expect(log.length).toBe(2)
    expect(log.canRedo).toBe(false)
    expect(log.opsBetween(0, 2)).toEqual([...step(1), ...step(3)])
  })

  it('allows only UNDO_LIMIT steps back', () => {
    const log = new HistoryLog()
    for (let i = 1; i <= UNDO_LIMIT + 20; i++) log.push(step(i))

    let undone = 0
    while (log.undo()) undone++

    expect(undone).toBe(UNDO_LIMIT)
    expect(log.floor).toBe(20)
  })

  it('counts the limit from the end of a loaded history too', () => {
    const log = new HistoryLog(state(Array.from({ length: 150 }, (_, i) => i + 1)))

    expect(log.floor).toBe(50)
    log.undo()
    log.push(step(999))
    expect(log.floor).toBe(50)
  })
})

describe('HistoryLog: saving', () => {
  it('has nothing to save after a load, and a save for new steps afterwards', () => {
    const log = new HistoryLog(state([1, 2]))
    expect(log.dirty).toBe(false)
    expect(log.nextSave(0)).toBeNull()

    log.push(step(3))
    const save = log.nextSave(10)

    expect(save).toMatchObject({ attempt: 1, rev: 1, keep: 2, cursor: 3, percent: 10 })
    expect(save?.steps).toEqual([step(3)])
  })

  it('sends only a cursor move for an undo, and does not send a second save while one is on its way', () => {
    const log = new HistoryLog(state([1, 2]))
    log.undo()

    const save = log.nextSave(0)
    expect(save).toMatchObject({ keep: 2, steps: [], cursor: 1 })
    expect(log.nextSave(0)).toBeNull()

    log.accepted(1, 2)
    expect(log.dirty).toBe(false)
    expect(log.rev).toBe(2)
  })

  it('keeps steps made while a save was on its way for the next one', () => {
    const log = new HistoryLog(state([]))
    log.push(step(1))
    log.nextSave(0)
    log.push(step(2))
    log.accepted(1, 2)

    const next = log.nextSave(0)
    expect(next).toMatchObject({ keep: 1, rev: 2, cursor: 2 })
    expect(next?.steps).toEqual([step(2)])
  })

  it('does not count steps as saved when a cut made them obsolete during the save', () => {
    const log = new HistoryLog(state([1, 2]))
    log.undo()
    log.undo()
    log.push(step(10))
    log.push(step(11))
    log.nextSave(0)
    // While it flies the player undoes both and draws something else.
    log.undo()
    log.undo()
    log.push(step(12))
    log.accepted(1, 2)

    const next = log.nextSave(0)
    expect(next).toMatchObject({ keep: 0, cursor: 1 })
    expect(next?.steps).toEqual([step(12)])
  })

  it('goes out in parts when the backlog is long, and the cursor never passes the part', () => {
    const log = new HistoryLog(state([]))
    for (let i = 1; i <= MAX_BATCH_STEPS + 5; i++) log.push(step(i))

    const first = log.nextSave(0)!
    expect(first.steps).toHaveLength(MAX_BATCH_STEPS)
    expect(first.cursor).toBe(MAX_BATCH_STEPS)
    log.accepted(1, 2)

    const second = log.nextSave(0)!
    expect(second).toMatchObject({ keep: MAX_BATCH_STEPS, cursor: MAX_BATCH_STEPS + 5 })
    expect(second.steps).toHaveLength(5)
  })

  it('sends the work again after a failure', () => {
    const log = new HistoryLog(state([]))
    log.push(step(1))
    log.nextSave(0)
    log.failed()

    expect(log.nextSave(0)?.steps).toEqual([step(1)])
  })

  it('pulls the confirmed part back when an undone step is replaced', () => {
    const log = new HistoryLog(state([1, 2, 3]))
    log.undo()
    log.push(step(9))

    const save = log.nextSave(0)
    expect(save).toMatchObject({ keep: 2, cursor: 3 })
    expect(save?.steps).toEqual([step(9)])
  })
})

describe('HistoryLog: a conflict', () => {
  it('puts unsent steps on top of what another device saved', () => {
    const log = new HistoryLog(state([1, 2]))
    log.push(step(3))
    log.nextSave(0)
    log.failed()

    const result = log.reconcile(state([1, 2, 7, 8], 4, 2))

    expect(result).toEqual({ rebuild: true, merged: true })
    expect(log.opsBetween(0, log.cursor)).toEqual([...step(1), ...step(2), ...step(7), ...step(8), ...step(3)])
    expect(log.rev).toBe(2)
    const save = log.nextSave(0)
    expect(save).toMatchObject({ keep: 4, cursor: 5, rev: 2 })
  })

  it('cuts the other device\'s redo branch, as any new step would', () => {
    const log = new HistoryLog(state([1]))
    log.push(step(2))

    log.reconcile(state([1, 5, 6], 2, 3))

    expect(log.opsBetween(0, log.cursor)).toEqual([...step(1), ...step(5), ...step(2)])
    expect(log.canRedo).toBe(false)
  })

  it('takes the server version when there is nothing of its own to add', () => {
    const log = new HistoryLog(state([1, 2]))
    log.undo()

    const result = log.reconcile(state([1, 2, 3], 3, 2))

    expect(result).toEqual({ rebuild: true, merged: false })
    expect(log.cursor).toBe(3)
    expect(log.dirty).toBe(false)
  })

  it('recognises a resent save that had arrived: nothing to rebuild, nothing lost', () => {
    const log = new HistoryLog(state([1]))
    log.push(step(2))
    log.nextSave(0)
    log.failed()

    const result = log.reconcile(state([1, 2], 2, 2))

    expect(result).toEqual({ rebuild: false, merged: false })
    expect(log.dirty).toBe(false)
    expect(log.rev).toBe(2)
  })

  it('keeps the local cursor for a resent save and sends it on', () => {
    const log = new HistoryLog(state([1]))
    log.push(step(2))
    log.nextSave(0)
    log.failed()
    log.undo()

    log.reconcile(state([1, 2], 2, 2))

    expect(log.cursor).toBe(1)
    expect(log.nextSave(0)).toMatchObject({ keep: 2, steps: [], cursor: 1 })
  })
})

describe('HistoryLog: coming back to unsent work', () => {
  const unsentOf = (log: HistoryLog) => log.unsent!

  it('has no unsent work once everything is saved', () => {
    const log = new HistoryLog(state([1]))

    expect(log.unsent).toBeNull()
    log.push(step(2))
    expect(unsentOf(log)).toEqual({ attempt: 1, rev: 1, keep: 1, steps: [step(2)], cursor: 2 })
  })

  it('restores exactly when the server is where the work was built', () => {
    const before = new HistoryLog(state([1, 2]))
    before.push(step(3))
    before.undo()
    const saved = unsentOf(before)

    const log = new HistoryLog()
    const result = log.restore(state([1, 2]), saved)

    expect(result.merged).toBe(false)
    expect(log.cursor).toBe(2)
    expect(log.length).toBe(3)
    expect(log.nextSave(0)).toMatchObject({ keep: 2, cursor: 2 })
  })

  it('puts the work on top of what the server gained meanwhile', () => {
    const before = new HistoryLog(state([1]))
    before.push(step(2))

    const log = new HistoryLog()
    const result = log.restore(state([1, 8, 9], 3, 2), unsentOf(before))

    expect(result.merged).toBe(true)
    expect(log.opsBetween(0, log.cursor)).toEqual([...step(1), ...step(8), ...step(9), ...step(2)])
    expect(log.nextSave(0)).toMatchObject({ keep: 3, rev: 2, cursor: 4 })
  })

  it('does not add steps twice when the save had arrived and the page died before the answer', () => {
    const before = new HistoryLog(state([1]))
    before.push(step(2))
    const saved = unsentOf(before)

    const log = new HistoryLog()
    log.restore(state([1, 2], 2, 2), saved)

    expect(log.length).toBe(2)
    expect(log.dirty).toBe(false)
  })

  it('drops work of an attempt that was started over elsewhere', () => {
    const before = new HistoryLog(state([1]))
    before.push(step(2))

    const log = new HistoryLog()
    log.restore({ attempt: 2, rev: 0, cursor: 0, steps: [] }, unsentOf(before))

    expect(log.length).toBe(0)
    expect(log.dirty).toBe(false)
  })
})
