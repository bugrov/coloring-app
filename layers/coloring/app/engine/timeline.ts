import { CHECKPOINT_EVERY, HistoryLog, UNDO_LIMIT, type Reconciliation, type UnsentHistory } from '../../shared/history'
import type { HistoryState, HistoryStep } from '../../shared'

/** What the timeline needs from the picture; the engine provides it, tests use a fake. */
export interface PaintHost<Snapshot, Delta = never> {
  /** A blank picture. */
  clear: () => void
  /** Applies ops on top of the picture. */
  apply: (step: HistoryStep) => void
  /** The steps applied so far are final for now (the host may measure the picture once instead of per step). */
  settle: () => void
  snapshot: () => Snapshot
  restore: (snapshot: Snapshot) => void
  release: (snapshot: Snapshot) => void
  /** What the picture shows where the step is about to paint (its delta), or null. */
  capture: (step: HistoryStep) => Delta | null
  /** Exchanges a step's saved pixels with the picture: undoes the step, and done again redoes it. */
  swap: (delta: Delta) => void
  discard: (delta: Delta) => void
  /** Memory a delta holds, in pixels. */
  cost: (delta: Delta) => number
}

/** Memory the per-step deltas may hold together, in pixels (4 bytes each): about 48 MB. */
const DELTA_BUDGET_PIXELS = 12_000_000

/** Steps replayed between two pauses when a whole history is rebuilt, so the page stays responsive. */
const REBUILD_CHUNK = CHECKPOINT_EVERY

function pause(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve))
}

/**
 * The picture and its history together. The picture is a canvas that cannot be "stepped back", so
 * two things are kept:
 * - for the latest steps (as far as DELTA_BUDGET_PIXELS allows) the pixels each one covered, so one
 *   undo or redo swaps a small piece of the canvas and replays nothing;
 * - every CHECKPOINT_EVERY steps a snapshot of the whole picture (inside the undo window only), so
 *   going to any other step costs a restore and fewer than CHECKPOINT_EVERY steps of replay.
 * Both are bounded, so memory does not grow with the history, and neither depends on its length.
 */
export class Timeline<Snapshot, Delta = never> {
  readonly log: HistoryLog
  /** How many steps the picture shows now. */
  private applied = 0
  private readonly checkpoints = new Map<number, Snapshot>()
  /** Saved pixels of single steps by the step's index (0 is the first step). */
  private readonly deltas = new Map<number, Delta>()
  private deltaPixels = 0

  constructor(private readonly host: PaintHost<Snapshot, Delta>, log = new HistoryLog()) {
    this.log = log
  }

  /** Shows the server's version: replays its steps up to the cursor. */
  async load(state: HistoryState) {
    this.log.load(state)
    await this.rebuild()
  }

  /** Opens an attempt: the server's version and the work an earlier visit left unsent. */
  async open(server: HistoryState, unsent: UnsentHistory | null): Promise<Reconciliation> {
    const result = this.log.restore(server, unsent)
    await this.rebuild()
    return result
  }

  /** Puts the server's newer version together with the local steps (see `HistoryLog.reconcile`). */
  async reconcile(server: HistoryState): Promise<Reconciliation> {
    const result = this.log.reconcile(server)
    if (result.rebuild) await this.rebuild()
    return result
  }

  /** A step the player just drew: the picture already shows it. `delta` is what it covered before. */
  record(step: HistoryStep, delta?: Delta | null) {
    const before = this.log.cursor
    this.log.push(step)
    this.applied = this.log.cursor
    // The old redo branch is gone, snapshots and deltas of it with it.
    this.dropCheckpoints(index => index > before)
    this.dropCheckpoints(index => index < this.firstCheckpoint())
    this.dropDeltas(index => index >= before || index < this.log.floor)
    if (delta) this.keepDelta(before, delta)
    this.keepCheckpoint(this.applied)
  }

  undo(): boolean {
    if (!this.log.undo()) return false
    this.moveTo(this.log.cursor)
    return true
  }

  redo(): boolean {
    if (!this.log.redo()) return false
    this.moveTo(this.log.cursor)
    return true
  }

  /** Blank picture and an empty history, for "start over". */
  reset(attempt: number) {
    this.log.load({ attempt, rev: 0, cursor: 0, steps: [] })
    this.releaseAll()
    this.host.clear()
    this.applied = 0
  }

  dispose() {
    this.releaseAll()
  }

  /** Number of single-step deltas held, for tests and the memory budget. */
  get deltaCount(): number {
    return this.deltas.size
  }

  /** Number of snapshots held, for tests and the memory budget. */
  get checkpointCount(): number {
    return this.checkpoints.size
  }

  /** The oldest step a snapshot is kept for: the start of the undo window, rounded down to a snapshot step. */
  private firstCheckpoint(): number {
    return this.log.floor - (this.log.floor % CHECKPOINT_EVERY)
  }

  private keepCheckpoint(index: number) {
    if (index === 0 || index % CHECKPOINT_EVERY !== 0 || index < this.firstCheckpoint() || this.checkpoints.has(index)) return
    // The snapshot carries the progress counts, which must include the steps applied so far.
    this.host.settle()
    this.checkpoints.set(index, this.host.snapshot())
  }

  private dropCheckpoints(drop: (index: number) => boolean) {
    for (const [index, snapshot] of this.checkpoints) {
      if (!drop(index)) continue
      this.host.release(snapshot)
      this.checkpoints.delete(index)
    }
  }

  private releaseAll() {
    this.dropCheckpoints(() => true)
    this.dropDeltas(() => true)
  }

  private keepDelta(index: number, delta: Delta) {
    this.deltas.set(index, delta)
    this.deltaPixels += this.host.cost(delta)
    // Over the budget the oldest go first: those are the steps least likely to be undone next.
    while (this.deltaPixels > DELTA_BUDGET_PIXELS && this.deltas.size > 0) {
      const oldest = Math.min(...this.deltas.keys())
      this.dropDeltas(candidate => candidate === oldest)
    }
  }

  private dropDeltas(drop: (index: number) => boolean) {
    for (const [index, delta] of this.deltas) {
      if (!drop(index)) continue
      this.deltaPixels -= this.host.cost(delta)
      this.host.discard(delta)
      this.deltas.delete(index)
    }
  }

  /** Replays the whole history from a blank picture, in chunks, keeping the snapshots on the way. */
  private async rebuild() {
    this.releaseAll()
    this.host.clear()
    this.applied = 0
    const target = this.log.cursor
    // The latest steps get their pixels saved on the way, so undoing them after a reload is as quick as right after drawing.
    const saveFrom = Math.max(0, target - UNDO_LIMIT)
    while (this.applied < target) {
      this.replay(this.applied, Math.min(target, this.applied + REBUILD_CHUNK), saveFrom)
      await pause()
    }
  }

  /** Makes the picture show `target` steps, from the nearest snapshot or from where it is. */
  private moveTo(target: number) {
    // One step either way and its pixels are at hand: swap them, no replay.
    if (Math.abs(target - this.applied) === 1) {
      const delta = this.deltas.get(Math.min(target, this.applied))
      if (delta !== undefined) {
        this.host.swap(delta)
        this.applied = target
        this.host.settle()
        this.keepCheckpoint(target)
        return
      }
    }
    let from = this.applied
    if (target < from) {
      const base = this.nearest(index => index <= target)
      if (base === undefined) {
        this.host.clear()
        from = 0
      }
      else {
        this.host.restore(this.checkpoints.get(base)!)
        from = base
      }
    }
    else {
      const ahead = this.nearest(index => index > from && index <= target)
      if (ahead !== undefined) {
        this.host.restore(this.checkpoints.get(ahead)!)
        from = ahead
      }
    }
    this.replay(from, target)
  }

  /** The highest checkpoint index that passes `accept`. */
  private nearest(accept: (index: number) => boolean): number | undefined {
    let best: number | undefined
    for (const index of this.checkpoints.keys()) {
      if (accept(index) && (best === undefined || index > best)) best = index
    }
    return best
  }

  /** Applies steps `from` (included) to `to` (excluded), keeping a snapshot at each snapshot step. */
  private replay(from: number, to: number, saveDeltasFrom = Infinity) {
    for (let index = from; index < to; index++) {
      const step = this.log.stepAt(index)
      if (index >= saveDeltasFrom) {
        const delta = this.host.capture(step)
        if (delta) this.keepDelta(index, delta)
      }
      this.host.apply(step)
      this.applied = index + 1
      this.keepCheckpoint(this.applied)
    }
    this.applied = to
    this.host.settle()
  }
}
