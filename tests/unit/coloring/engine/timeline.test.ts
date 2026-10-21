import { describe, expect, it } from 'vitest'
import { Timeline, type PaintHost } from '../../../../layers/coloring/app/engine/timeline'
import { CHECKPOINT_EVERY, UNDO_LIMIT } from '../../../../layers/coloring/shared/history'
import type { HistoryState, HistoryStep } from '../../../../layers/coloring/shared'

const step = (region: number): HistoryStep => [{ type: 'fill', region, color: '#e53935' }]
const regionOf = (value: HistoryStep) => value[0]!.region

/** A "picture" that is the list of regions applied so far; counts the work done. */
function fakeHost() {
  const host = {
    picture: [] as number[],
    applied: 0,
    restores: 0,
    snapshots: 0,
    released: 0,
    clear() { host.picture = [] },
    apply(value: HistoryStep) { host.picture.push(regionOf(value)); host.applied++ },
    snapshot() { host.snapshots++; return [...host.picture] },
    restore(snapshot: number[]) { host.restores++; host.picture = [...snapshot] },
    release() { host.released++ },
  }
  return host satisfies PaintHost<number[]> & Record<string, unknown>
}

const history = (count: number, cursor = count, rev = 1): HistoryState => ({
  attempt: 1,
  rev,
  cursor,
  steps: Array.from({ length: count }, (_, i) => step(i + 1)),
})
const upTo = (count: number) => Array.from({ length: count }, (_, i) => i + 1)

describe('Timeline: a long history', () => {
  it('rebuilds the picture up to the cursor and holds only the snapshots of the undo window', async () => {
    const host = fakeHost()
    const timeline = new Timeline(host)

    await timeline.load(history(1000))

    expect(host.picture).toEqual(upTo(1000))
    expect(timeline.checkpointCount).toBeLessThanOrEqual(UNDO_LIMIT / CHECKPOINT_EVERY + 1)
    expect(timeline.log.floor).toBe(900)
  })

  it('goes back and forth with a restore and fewer than CHECKPOINT_EVERY steps of replay', async () => {
    const host = fakeHost()
    const timeline = new Timeline(host)
    await timeline.load(history(1000))

    for (let i = 0; i < UNDO_LIMIT; i++) {
      host.applied = 0
      expect(timeline.undo()).toBe(true)
      expect(host.applied).toBeLessThan(CHECKPOINT_EVERY)
      expect(host.picture).toEqual(upTo(1000 - i - 1))
    }
    expect(timeline.undo()).toBe(false)

    for (let i = 0; i < UNDO_LIMIT; i++) {
      host.applied = 0
      expect(timeline.redo()).toBe(true)
      expect(host.applied).toBeLessThan(CHECKPOINT_EVERY)
      expect(host.picture).toEqual(upTo(900 + i + 1))
    }
  })

  it('does not hold more snapshots as the player keeps drawing', async () => {
    const host = fakeHost()
    const timeline = new Timeline(host)
    await timeline.load(history(0))

    for (let i = 1; i <= 1000; i++) {
      host.picture.push(i)
      timeline.record(step(i))
    }

    expect(timeline.checkpointCount).toBeLessThanOrEqual(UNDO_LIMIT / CHECKPOINT_EVERY + 1)
    expect(host.released).toBeGreaterThan(0)
  })
})

describe('Timeline: undo, redo and new steps', () => {
  it('shows the picture of the cursor after an undo, a redo and a new step', async () => {
    const host = fakeHost()
    const timeline = new Timeline(host)
    await timeline.load(history(0))

    for (let i = 1; i <= 60; i++) {
      host.picture.push(i)
      timeline.record(step(i))
    }
    timeline.undo()
    timeline.undo()
    expect(host.picture).toEqual(upTo(58))

    host.picture.push(99)
    timeline.record(step(99))
    expect(timeline.log.canRedo).toBe(false)

    timeline.undo()
    expect(host.picture).toEqual(upTo(58))
    timeline.undo()
    expect(host.picture).toEqual(upTo(57))
    timeline.redo()
    timeline.redo()
    expect(host.picture).toEqual([...upTo(58), 99])
  })

  it('forgets the snapshots of an undone branch when a new step replaces it', async () => {
    const host = fakeHost()
    const timeline = new Timeline(host)
    await timeline.load(history(80))
    for (let i = 0; i < 40; i++) timeline.undo()

    host.picture.push(500)
    timeline.record(step(500))
    timeline.undo()

    // Step 50 is not 50 of the old history any more; going back must not resurrect it.
    expect(host.picture).toEqual(upTo(40))
    timeline.redo()
    expect(host.picture).toEqual([...upTo(40), 500])
  })

  it('starts blank on reset', async () => {
    const host = fakeHost()
    const timeline = new Timeline(host)
    await timeline.load(history(60))

    timeline.reset(2)

    expect(host.picture).toEqual([])
    expect(timeline.log.attempt).toBe(2)
    expect(timeline.log.canUndo).toBe(false)
    expect(timeline.checkpointCount).toBe(0)
  })
})

describe('Timeline: a conflict', () => {
  it('rebuilds the picture from the server steps with the local ones on top', async () => {
    const host = fakeHost()
    const timeline = new Timeline(host)
    await timeline.load(history(3))
    host.picture.push(10)
    timeline.record(step(10))

    const result = await timeline.reconcile({ attempt: 1, rev: 2, cursor: 5, steps: [1, 2, 3, 7, 8].map(step) })

    expect(result).toEqual({ rebuild: true, merged: true })
    expect(host.picture).toEqual([1, 2, 3, 7, 8, 10])
  })

  it('leaves the picture alone for a resent save that had arrived', async () => {
    const host = fakeHost()
    const timeline = new Timeline(host)
    await timeline.load(history(2))
    host.picture.push(3)
    timeline.record(step(3))
    const before = host.applied

    const result = await timeline.reconcile({ attempt: 1, rev: 2, cursor: 3, steps: [1, 2, 3].map(step) })

    expect(result.rebuild).toBe(false)
    expect(host.applied).toBe(before)
  })
})
