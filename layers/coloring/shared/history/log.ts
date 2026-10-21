import { MAX_BATCH_BYTES, MAX_BATCH_STEPS, UNDO_LIMIT } from './constants'
import type { HistoryState, HistoryStep, SaveHistoryRequest } from '../types'

/** What `HistoryLog.reconcile` did with the server's version. */
export interface Reconciliation {
  /** The steps the editor shows changed: the canvas has to be rebuilt. */
  rebuild: boolean
  /** Local steps the server did not have were put on top of the server's. */
  merged: boolean
}

function sameStep(a: HistoryStep, b: HistoryStep): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}

/** How many steps two histories share from the start. */
function commonPrefix(a: readonly HistoryStep[], b: readonly HistoryStep[]): number {
  let length = 0
  while (length < a.length && length < b.length && sameStep(a[length]!, b[length]!)) length++
  return length
}

/**
 * What is not on the server yet, as it is kept across a reload or a closed tab (IndexedDB):
 * the revision it was built on and the steps after the first `keep`.
 */
export interface UnsentHistory {
  attempt: number
  rev: number
  keep: number
  steps: HistoryStep[]
  cursor: number
}

/**
 * The history of one attempt as the editor holds it: steps, the cursor among them, and what the
 * server has of it. No DOM and no network, so the rules of undo, saving and conflicts are tested
 * on their own.
 *
 * `confirmed` steps from the start are known to be on the server as they are here; a save sends the
 * rest. A new step after an undo cuts the redo branch, which also pulls `confirmed` back.
 */
export class HistoryLog {
  private steps: HistoryStep[] = []
  private position = 0
  private undoFloor = 0
  private confirmed = 0
  private serverCursor = 0
  /** The save that is on its way, if any. */
  private sending: { keep: number, count: number, cursor: number } | null = null
  /** The lowest cut a new step made while a save was on its way. */
  private cutDuringSend = Infinity
  attempt = 0
  rev = 0

  constructor(state?: HistoryState) {
    if (state) this.load(state)
  }

  /** Takes the server's version as it is; nothing is left to send. */
  load(state: HistoryState) {
    this.attempt = state.attempt
    this.rev = state.rev
    this.steps = state.steps.map(step => [...step])
    this.position = state.cursor
    this.confirmed = state.steps.length
    this.serverCursor = state.cursor
    this.undoFloor = Math.max(0, this.steps.length - UNDO_LIMIT)
    this.sending = null
    this.cutDuringSend = Infinity
  }

  get cursor(): number {
    return this.position
  }

  get length(): number {
    return this.steps.length
  }

  get canUndo(): boolean {
    return this.position > this.undoFloor
  }

  get canRedo(): boolean {
    return this.position < this.steps.length
  }

  /** The lowest cursor undo may reach. */
  get floor(): number {
    return this.undoFloor
  }

  stepAt(index: number): HistoryStep {
    return this.steps[index]!
  }

  /** Steps `from` (included) to `to` (excluded), flattened into ops. */
  opsBetween(from: number, to: number) {
    return this.steps.slice(from, to).flat()
  }

  push(step: HistoryStep) {
    this.cutDuringSend = Math.min(this.cutDuringSend, this.position)
    this.confirmed = Math.min(this.confirmed, this.position)
    this.steps = [...this.steps.slice(0, this.position), step]
    this.position = this.steps.length
    this.undoFloor = Math.max(this.undoFloor, this.steps.length - UNDO_LIMIT)
  }

  undo(): boolean {
    if (!this.canUndo) return false
    this.position--
    return true
  }

  redo(): boolean {
    if (!this.canRedo) return false
    this.position++
    return true
  }

  /** Whether there is anything to save. */
  get dirty(): boolean {
    return this.steps.length > this.confirmed || this.position !== this.serverCursor
  }

  /** The work that is not on the server yet, or null when everything is saved. */
  get unsent(): UnsentHistory | null {
    if (!this.dirty) return null
    return { attempt: this.attempt, rev: this.rev, keep: this.confirmed, steps: this.steps.slice(this.confirmed), cursor: this.position }
  }

  /** How many steps wait to be saved. */
  get unsavedSteps(): number {
    return Math.max(0, this.steps.length - this.confirmed)
  }

  /**
   * The next save, or null when everything is saved or one is on its way. A backlog goes out in
   * parts of at most MAX_BATCH_STEPS steps and MAX_BATCH_BYTES bytes (one step at least).
   */
  nextSave(percent: number): SaveHistoryRequest | null {
    if (this.sending || !this.dirty) return null
    const steps: HistoryStep[] = []
    let bytes = 0
    for (const step of this.steps.slice(this.confirmed, this.confirmed + MAX_BATCH_STEPS)) {
      bytes += JSON.stringify(step).length
      if (steps.length > 0 && bytes > MAX_BATCH_BYTES) break
      steps.push(step)
    }
    const cursor = Math.min(this.position, this.confirmed + steps.length)
    this.sending = { keep: this.confirmed, count: steps.length, cursor }
    this.cutDuringSend = Infinity
    return { attempt: this.attempt, rev: this.rev, keep: this.confirmed, steps, cursor, percent }
  }

  /** The server took the save that was on its way. */
  accepted(attempt: number, rev: number) {
    const sent = this.sending
    this.sending = null
    if (!sent) return
    this.attempt = attempt
    this.rev = rev
    this.confirmed = Math.min(sent.keep + sent.count, this.cutDuringSend)
    this.serverCursor = sent.cursor
    this.cutDuringSend = Infinity
  }

  /** The save that was on its way did not arrive; it will be built again. */
  failed() {
    this.sending = null
    this.cutDuringSend = Infinity
  }

  /**
   * The server answered a save with a conflict and this is its current version. Nothing is thrown
   * away: steps the server does not have are put on top of the ones it does (applied ones only: the
   * server's redo branch is cut, as any new step would cut it). With no steps of its own, the editor
   * simply takes the server's version, apart from a resent save that is already stored.
   */
  reconcile(server: HistoryState): Reconciliation {
    const shared = commonPrefix(this.steps, server.steps)
    const unsent = this.steps.slice(shared, this.position)

    if (unsent.length === 0) {
      // A resent save that had arrived after all: the editor already is the server's version.
      const stored = shared === this.steps.length && shared === server.steps.length
      const cursor = stored ? this.position : server.cursor
      this.load({ ...server, cursor })
      if (stored && cursor !== server.cursor) this.serverCursor = server.cursor
      return { rebuild: !stored, merged: false }
    }

    const base = server.steps.slice(0, server.cursor)
    this.load({ ...server, steps: [...base, ...unsent], cursor: base.length + unsent.length })
    this.confirmed = base.length
    this.serverCursor = server.cursor
    return { rebuild: true, merged: true }
  }

  /**
   * Opens an attempt: the server's version plus the work an earlier visit left unsent (it survives
   * a reload or a closed tab). Unsent steps are never dropped unless their attempt was started
   * over elsewhere. If the server moved on meanwhile, they go on top of its applied steps; if it
   * already has them (the save arrived, the page died before hearing back), they are not added twice.
   */
  restore(server: HistoryState, unsent: UnsentHistory | null): Reconciliation {
    if (!unsent || unsent.attempt !== server.attempt || unsent.keep > server.steps.length) {
      this.load(server)
      return { rebuild: true, merged: false }
    }
    if (unsent.rev === server.rev) {
      this.load({ ...server, steps: [...server.steps.slice(0, unsent.keep), ...unsent.steps], cursor: unsent.cursor })
      this.confirmed = unsent.keep
      this.serverCursor = server.cursor
      return { rebuild: true, merged: false }
    }
    const stored = unsent.steps.every((step, index) => {
      const onServer = server.steps[unsent.keep + index]
      return onServer !== undefined && sameStep(onServer, step)
    })
    if (stored) {
      this.load(server)
      return { rebuild: true, merged: false }
    }
    const base = server.steps.slice(0, server.cursor)
    const mine = unsent.steps.slice(0, Math.max(0, unsent.cursor - unsent.keep))
    this.load({ ...server, steps: [...base, ...mine], cursor: base.length + mine.length })
    this.confirmed = base.length
    this.serverCursor = server.cursor
    return { rebuild: true, merged: mine.length > 0 }
  }
}
