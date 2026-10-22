import { describe, expect, it } from 'vitest'
import { Timeline, type PaintHost } from '../../../../layers/coloring/app/engine/timeline'
import { CHECKPOINT_EVERY, UNDO_LIMIT } from '../../../../layers/coloring/shared/history'
import type { HistoryState, HistoryStep } from '../../../../layers/coloring/shared'

const step = (region: number): HistoryStep => [{ type: 'fill', region, color: '#e53935' }]
const regionOf = (value: HistoryStep) => value[0]!.region

/** The pixels a step covered: here the whole fake picture as it was, and a memory cost. */
interface FakeDelta {
  saved: number[]
  pixels: number
}

/** A "picture" that is the list of regions applied so far; counts the work done. */
function fakeHost() {
  const host = {
    picture: [] as number[],
    applied: 0,
    restores: 0,
    snapshots: 0,
    released: 0,
    clear() { host.picture = [] },
    apply(value: HistoryStep) {
      host.picture.push(regionOf(value))
      host.applied++
    },
    settle: () => undefined,
    swapped: 0,
    discarded: 0,
    swap(delta: FakeDelta) {
      host.swapped++
      const current = host.picture

      host.picture = [...delta.saved]
      delta.saved = current
    },
    discard() {
      host.discarded++
    },
    cost: (delta: FakeDelta) => delta.pixels,
    capture(): FakeDelta | null {
      return { saved: [...host.picture], pixels: 10 }
    },
    snapshot() {
      host.snapshots++

      return [...host.picture]
    },
    restore(snapshot: number[]) {
      host.restores++
      host.picture = [...snapshot]
    },
    release() { host.released++ },
  }

  return host satisfies PaintHost<number[], FakeDelta> & Record<string, unknown>
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
    const timeline = new Timeline<number[], FakeDelta>(host)

    await timeline.load(history(1000))

    expect(host.picture).toEqual(upTo(1000))
    expect(timeline.checkpointCount).toBeLessThanOrEqual(UNDO_LIMIT / CHECKPOINT_EVERY + 1)
    expect(timeline.log.floor).toBe(900)
  })

  it('goes back and forth with a restore and fewer than CHECKPOINT_EVERY steps of replay', async () => {
    const host = fakeHost()
    const timeline = new Timeline<number[], FakeDelta>(host)

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
    const timeline = new Timeline<number[], FakeDelta>(host)

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
    const timeline = new Timeline<number[], FakeDelta>(host)

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
    const timeline = new Timeline<number[], FakeDelta>(host)

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

  it('starts blank when a fresh, empty history is loaded (start over)', async () => {
    const host = fakeHost()
    const timeline = new Timeline<number[], FakeDelta>(host)

    await timeline.load(history(60))

    await timeline.load({ attempt: 2, rev: 0, cursor: 0, steps: [] })

    expect(host.picture).toEqual([])
    expect(timeline.log.attempt).toBe(2)
    expect(timeline.log.canUndo).toBe(false)
    expect(timeline.checkpointCount).toBe(0)
  })
})

describe('Timeline: the pixels of single steps', () => {
  /** Draws a step the way the editor does: the picture changes, the delta is what it was before. */
  const draw = (host: ReturnType<typeof fakeHost>, timeline: Timeline<number[], FakeDelta>, region: number, pixels = 10) => {
    const delta = { saved: [...host.picture], pixels }

    host.picture.push(region)
    timeline.record(step(region), delta)
  }

  it('undoes and redoes the latest steps by swapping pixels, without replaying anything', async () => {
    const host = fakeHost()
    const timeline = new Timeline<number[], FakeDelta>(host)

    await timeline.load(history(0))

    for (let i = 1; i <= 30; i++) draw(host, timeline, i)
    host.applied = 0
    host.restores = 0

    for (let i = 29; i >= 10; i--) {
      timeline.undo()
      expect(host.picture).toEqual(upTo(i))
    }

    for (let i = 11; i <= 30; i++) {
      timeline.redo()
      expect(host.picture).toEqual(upTo(i))
    }

    expect(host.applied).toBe(0)
    expect(host.restores).toBe(0)
    expect(host.swapped).toBe(40)
  })

  it('saves the pixels of the latest steps while a history loads, so they undo quickly after a reload', async () => {
    const host = fakeHost()
    const timeline = new Timeline<number[], FakeDelta>(host)

    await timeline.load(history(150))
    host.applied = 0

    for (let i = 149; i >= 50; i--) {
      timeline.undo()
      expect(host.picture).toEqual(upTo(i))
    }

    expect(timeline.deltaCount).toBe(100)
    expect(host.applied).toBe(0)
    expect(host.swapped).toBe(100)
  })

  it('falls back to a snapshot and replay for a step that has no pixels saved', async () => {
    const host = fakeHost()

    host.capture = () => null
    const timeline = new Timeline<number[], FakeDelta>(host)

    await timeline.load(history(60))
    host.applied = 0

    timeline.undo()

    expect(host.picture).toEqual(upTo(59))
    expect(host.swapped).toBe(0)
    expect(host.restores).toBe(1)
  })

  it('keeps the memory of the saved pixels within the budget, dropping the oldest first', async () => {
    const host = fakeHost()
    const timeline = new Timeline<number[], FakeDelta>(host)

    await timeline.load(history(0))

    for (let i = 1; i <= 10; i++) draw(host, timeline, i, 5_000_000)

    expect(timeline.deltaCount).toBe(2)
    expect(host.discarded).toBe(8)
    // The newest steps still undo by swapping; the older ones by replay, and the picture is right either way.
    timeline.undo()
    timeline.undo()
    expect(host.swapped).toBe(2)
    timeline.undo()
    expect(host.picture).toEqual(upTo(7))
  })

  it('drops the pixels of an undone branch when a new step replaces it', async () => {
    const host = fakeHost()
    const timeline = new Timeline<number[], FakeDelta>(host)

    await timeline.load(history(0))

    for (let i = 1; i <= 5; i++) draw(host, timeline, i)
    timeline.undo()
    timeline.undo()
    expect(timeline.deltaCount).toBe(5)

    draw(host, timeline, 99)

    expect(timeline.deltaCount).toBe(4)
    timeline.undo()
    expect(host.picture).toEqual(upTo(3))
    timeline.redo()
    expect(host.picture).toEqual([...upTo(3), 99])
  })

  it('forgets the pixels when the history is replaced', async () => {
    const host = fakeHost()
    const timeline = new Timeline<number[], FakeDelta>(host)

    await timeline.load(history(0))

    for (let i = 1; i <= 3; i++) draw(host, timeline, i)

    // The new history brings its own pixels (saved while it loads), none of the old ones remain.
    host.capture = () => null
    await timeline.load(history(5))

    expect(timeline.deltaCount).toBe(0)
    expect(host.discarded).toBeGreaterThanOrEqual(3)
  })
})

describe('Timeline: a conflict', () => {
  it('rebuilds the picture from the server steps with the local ones on top', async () => {
    const host = fakeHost()
    const timeline = new Timeline<number[], FakeDelta>(host)

    await timeline.load(history(3))
    host.picture.push(10)
    timeline.record(step(10))

    const result = await timeline.reconcile({ attempt: 1, rev: 2, cursor: 5, steps: [1, 2, 3, 7, 8].map(step) })

    expect(result).toEqual({ rebuild: true, merged: true })
    expect(host.picture).toEqual([1, 2, 3, 7, 8, 10])
  })

  it('leaves the picture alone for a resent save that had arrived', async () => {
    const host = fakeHost()
    const timeline = new Timeline<number[], FakeDelta>(host)

    await timeline.load(history(2))
    host.picture.push(3)
    timeline.record(step(3))
    const before = host.applied

    const result = await timeline.reconcile({ attempt: 1, rev: 2, cursor: 3, steps: [1, 2, 3].map(step) })

    expect(result.rebuild).toBe(false)
    expect(host.applied).toBe(before)
  })
})

describe('Timeline: a rebuild that is no longer wanted', () => {
  it('stops applying steps once the timeline is disposed, and holds nothing', async () => {
    const host = fakeHost()
    const timeline = new Timeline<number[], FakeDelta>(host)
    const loading = timeline.load(history(200))

    timeline.dispose()
    await loading

    // Only the chunk that was already running was applied.
    expect(host.applied).toBeLessThanOrEqual(CHECKPOINT_EVERY)
    expect(timeline.checkpointCount).toBe(0)
    expect(timeline.deltaCount).toBe(0)
  })

  it('does not touch the picture again when a later rebuild has taken over', async () => {
    const host = fakeHost()
    const timeline = new Timeline<number[], FakeDelta>(host)
    const first = timeline.load(history(200))
    const second = timeline.load(history(50))

    await Promise.all([first, second])

    expect(host.picture).toEqual(upTo(50))
  })

  it('takes a new step into no account after it is disposed, and gives its pixels back', () => {
    const host = fakeHost()
    const timeline = new Timeline<number[], FakeDelta>(host)

    timeline.dispose()
    timeline.record(step(1), { saved: [], pixels: 10 })

    expect(timeline.log.length).toBe(0)
    expect(host.discarded).toBe(1)
  })
})

describe('Timeline: a save that arrived whose answer was lost', () => {
  it('keeps the picture as it is when the server holds only steps the editor has too', async () => {
    const host = fakeHost()
    const timeline = new Timeline<number[], FakeDelta>(host)

    await timeline.load(history(2))
    timeline.record(step(3))
    timeline.record(step(4))
    const appliedBefore = host.applied

    const result = await timeline.reconcile(history(3, 3, 5))

    expect(result).toEqual({ rebuild: false, merged: false })
    expect(host.applied).toBe(appliedBefore)
    // The fake host does not draw the recorded steps itself: what counts is that nothing was cleared or replayed.
    expect(host.picture).toEqual([1, 2])
    expect(timeline.log.length).toBe(4)
    expect(timeline.log.rev).toBe(5)
  })
})
