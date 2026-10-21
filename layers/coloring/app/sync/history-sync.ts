import type { HistoryState, SaveHistoryRequest, SaveHistoryResult } from '../../shared'
import type { HistoryLog, Reconciliation } from '../../shared/history'
import {
  MAX_CONFLICTS_IN_A_ROW,
  OUTBOX_DELAY_MS,
  RETRY_BASE_MS,
  RETRY_MAX_MS,
  SAVE_AT_STEPS,
  SAVE_DELAY_MS,
  SAVE_MAX_WAIT_MS,
} from './constants'
import type { Outbox } from './outbox'

/** `saved`: all on the server. `saving`: work waits or is on its way. `offline`: will retry. `failed`: the server refused. */
export type SyncStatus = 'saved' | 'saving' | 'offline' | 'failed'

/** The server has a newer version of the history than the save was built on. */
export class SyncConflict extends Error {}

/** The server will never take this save as it is (not signed in, art gone, invalid); retrying is pointless. */
export class SyncRejected extends Error {}

/** The two requests the editor makes; anything else that throws is a failure to reach the server, to be retried. */
export interface SyncApi {
  save: (request: SaveHistoryRequest) => Promise<SaveHistoryResult>
  load: () => Promise<HistoryState>
}

/** The part of `Timeline` the sync needs. */
export interface SyncTimeline {
  readonly log: HistoryLog
  reconcile: (server: HistoryState) => Promise<Reconciliation>
}

export interface HistorySyncOptions {
  timeline: SyncTimeline
  api: SyncApi
  outbox: Outbox
  /** Names this player's work on this art in the outbox. */
  key: string
  /** Progress of the picture right now, sent with each save. */
  percent: () => number
  onStatus: (status: SyncStatus) => void
  /** A conflict was settled: the picture may have been rebuilt, local steps may have been put on top of the server's. */
  onReconciled: (result: Reconciliation) => void
  /** The picture is being rebuilt after a conflict: drawing has to wait. */
  onRebuilding: (rebuilding: boolean) => void
}

/**
 * Saves the history to the server in the background, without ever waiting for it in the UI.
 * Changes are collected: a save goes out `SAVE_DELAY_MS` after the last one (at the latest
 * `SAVE_MAX_WAIT_MS` after the first, at once at `SAVE_AT_STEPS` waiting steps). Work that is not on
 * the server yet is also kept in the outbox, so closing the tab loses nothing. A failed save is
 * retried with growing pauses; a conflict is settled by `Timeline.reconcile` (nothing is dropped).
 */
export class HistorySync {
  status: SyncStatus = 'saved'
  private saveTimer: ReturnType<typeof setTimeout> | undefined
  private outboxTimer: ReturnType<typeof setTimeout> | undefined
  private retryTimer: ReturnType<typeof setTimeout> | undefined
  private firstChangeAt = 0
  private retryDelay = RETRY_BASE_MS
  private running: Promise<void> | null = null
  private disposed = false

  constructor(private readonly options: HistorySyncOptions) {}

  private get log() {
    return this.options.timeline.log
  }

  /** Call after every change of the history (a step, an undo, a redo). */
  changed() {
    if (this.disposed) return
    if (!this.log.dirty) return
    this.setStatus('saving')
    this.firstChangeAt ||= Date.now()
    this.scheduleOutbox()
    if (this.log.unsavedSteps >= SAVE_AT_STEPS) {
      void this.flush()
      return
    }
    const waited = Date.now() - this.firstChangeAt
    clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => void this.flush(), Math.max(0, Math.min(SAVE_DELAY_MS, SAVE_MAX_WAIT_MS - waited)))
  }

  /** Saves what waits, now; resolves when everything is on the server or a save failed. */
  flush(): Promise<void> {
    if (!this.running) this.running = this.run().finally(() => (this.running = null))
    return this.running
  }

  /** Writes unsent work to the outbox now (the page is going away). */
  persist(): Promise<void> {
    clearTimeout(this.outboxTimer)
    const unsent = this.log.unsent
    return unsent ? this.options.outbox.write(this.options.key, unsent) : this.options.outbox.remove(this.options.key)
  }

  /** The network is back: try again without waiting out the pause. */
  retryNow() {
    if (this.status === 'offline') void this.flush()
  }

  dispose() {
    this.disposed = true
    clearTimeout(this.saveTimer)
    clearTimeout(this.outboxTimer)
    clearTimeout(this.retryTimer)
  }

  private setStatus(status: SyncStatus) {
    if (status === this.status) return
    this.status = status
    this.options.onStatus(status)
  }

  private scheduleOutbox() {
    if (this.outboxTimer !== undefined) return
    this.outboxTimer = setTimeout(() => {
      this.outboxTimer = undefined
      void this.persist()
    }, OUTBOX_DELAY_MS)
  }

  private async run() {
    clearTimeout(this.saveTimer)
    clearTimeout(this.retryTimer)
    let conflicts = 0
    while (!this.disposed) {
      const request = this.log.nextSave(this.options.percent())
      if (!request) break
      this.setStatus('saving')
      try {
        const result = await this.options.api.save(request)
        this.log.accepted(result.attempt, result.rev)
        this.retryDelay = RETRY_BASE_MS
        conflicts = 0
      }
      catch (error) {
        this.log.failed()
        if (error instanceof SyncConflict) {
          if (++conflicts > MAX_CONFLICTS_IN_A_ROW || !await this.settleConflict()) return this.giveUp('failed')
          continue
        }
        return this.giveUp(error instanceof SyncRejected ? 'failed' : 'offline')
      }
    }
    this.firstChangeAt = 0
    await this.persist()
    this.setStatus('saved')
  }

  /** Reads the server's version and puts local steps on top of it; false when it could not be read. */
  private async settleConflict(): Promise<boolean> {
    let server: HistoryState
    try {
      server = await this.options.api.load()
    }
    catch {
      return false
    }
    this.options.onRebuilding(true)
    try {
      this.options.onReconciled(await this.options.timeline.reconcile(server))
    }
    finally {
      this.options.onRebuilding(false)
    }
    return true
  }

  private async giveUp(status: 'offline' | 'failed') {
    await this.persist()
    this.setStatus(status)
    if (status === 'offline' && !this.disposed) {
      this.retryTimer = setTimeout(() => void this.flush(), this.retryDelay)
      this.retryDelay = Math.min(this.retryDelay * 2, RETRY_MAX_MS)
    }
  }
}
