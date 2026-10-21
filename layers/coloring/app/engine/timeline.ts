import { CHECKPOINT_EVERY, HistoryLog, type Reconciliation, type UnsentHistory } from '../../shared/history'
import type { HistoryState, HistoryStep } from '../../shared'

/** What the timeline needs from the picture; the engine provides it, tests use a fake. */
export interface PaintHost<Snapshot> {
  /** A blank picture. */
  clear: () => void
  /** Applies ops on top of the picture. */
  apply: (step: HistoryStep) => void
  snapshot: () => Snapshot
  restore: (snapshot: Snapshot) => void
  release: (snapshot: Snapshot) => void
}

/** Steps replayed between two pauses when a whole history is rebuilt, so the page stays responsive. */
const REBUILD_CHUNK = CHECKPOINT_EVERY

function pause(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve))
}

/**
 * The picture and its history together. The picture is a canvas that cannot be "stepped back", so
 * every CHECKPOINT_EVERY steps a snapshot of it is kept (only inside the undo window): going to
 * any step then costs a restore and fewer than CHECKPOINT_EVERY steps of replay, however long the
 * history is, and at most UNDO_LIMIT / CHECKPOINT_EVERY + 1 snapshots are held, so memory does
 * not grow with the history either.
 */
export class Timeline<Snapshot> {
  readonly log: HistoryLog
  /** How many steps the picture shows now. */
  private applied = 0
  private readonly checkpoints = new Map<number, Snapshot>()

  constructor(private readonly host: PaintHost<Snapshot>, log = new HistoryLog()) {
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

  /** A step the player just drew: the picture already shows it. */
  record(step: HistoryStep) {
    const before = this.log.cursor
    this.log.push(step)
    this.applied = this.log.cursor
    // The old redo branch is gone, snapshots of it with it.
    this.dropCheckpoints(index => index > before)
    this.dropCheckpoints(index => index < this.firstCheckpoint())
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
  }

  /** Replays the whole history from a blank picture, in chunks, keeping the snapshots on the way. */
  private async rebuild() {
    this.releaseAll()
    this.host.clear()
    this.applied = 0
    const target = this.log.cursor
    while (this.applied < target) {
      this.replay(this.applied, Math.min(target, this.applied + REBUILD_CHUNK))
      await pause()
    }
  }

  /** Makes the picture show `target` steps, from the nearest snapshot or from where it is. */
  private moveTo(target: number) {
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
  private replay(from: number, to: number) {
    for (let index = from; index < to; index++) {
      this.host.apply(this.log.stepAt(index))
      this.applied = index + 1
      this.keepCheckpoint(this.applied)
    }
    this.applied = to
  }
}
