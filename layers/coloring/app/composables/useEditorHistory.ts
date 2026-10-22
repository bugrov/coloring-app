import { readApiError } from '#layers/core/shared/errors'
import { CoreRoutes } from '#layers/core/shared/routes'
import type { HistoryState, HistoryStep } from '../../shared'
import type { Reconciliation } from '../../shared/history'
import { THUMBNAIL_LONG_SIDE } from '../../shared/gallery'
import { HISTORY_ERROR_MESSAGES, HISTORY_NOTICES } from '../../shared'
import { Timeline, type PaintDelta, type PaintSnapshot } from '../engine'
import { useEditorStore } from '../stores/editor'
import { HistorySync, IndexedDbOutbox, SyncConflict, SyncRejected, type SyncApi } from '../sync'
import type { ColoringStageHandle } from './useColoringStage'

/** HTTP statuses after which the same save would only fail again: not signed in, no such art, invalid. */
const REFUSED_STATUSES = new Set([401, 403, 404, 413, 422])

/** The gallery thumbnail follows the picture, but not more often than this, and a moment after the last save. */
const THUMBNAIL_MIN_INTERVAL_MS = 30_000
const THUMBNAIL_DELAY_MS = 3000

/** Leaving the editor waits this long at most for the last save and thumbnail, so the gallery shows them. */
const LEAVE_WAIT_MS = 1000

/** A request that has not answered in this long is a failed one: the save is retried, the player is not kept waiting. */
const REQUEST_TIMEOUT_MS = 15_000

export interface EditorHistoryHooks {
  /** The picture or the history changed by itself (loaded, undone, settled after a conflict). */
  onChanged: () => void
  notify: (message: string) => void
}

/**
 * The saved history of the art being edited: loads it onto the canvas, keeps the timeline (undo,
 * redo, snapshots) and the background saving (`HistorySync`) together, and guards the work when the
 * page goes away. The editor store mirrors what the buttons need.
 */
export function useEditorHistory(
  artId: Readonly<Ref<string>>,
  stage: Readonly<Ref<ColoringStageHandle | null>>,
  hooks: EditorHistoryHooks,
) {
  const editor = useEditorStore()
  const api = useRequestFetch()
  const { user } = useUserSession()
  const outbox = new IndexedDbOutbox()

  /** Why the saved history could not be loaded, for the player; empty when it loaded or is loading. */
  const loadError = ref('')

  let timeline: Timeline<PaintSnapshot, PaintDelta> | null = null
  let sync: HistorySync | null = null
  let thumbnailTimer: ReturnType<typeof setTimeout> | undefined
  let thumbnailDue = false
  let thumbnailSentAt = 0
  /** Counts the opens, so that a slow one for an art the player has left is dropped. */
  let generation = 0
  /** Whether the open that got the number `mine` is still the latest: false once the player left or opened another art. */
  const isCurrent = (mine: number) => mine === generation

  const outboxKey = (id: string) => `${user.value?.id ?? ''}:${id}`
  const historyUrl = (id: string) => `/api/coloring/arts/${id}/history`

  /** `current` tells whether the editor still shows this art: a late answer for one the player has left must not move them. */
  function syncApi(id: string, current: () => boolean): SyncApi {
    return {
      async save(request) {
        try {
          return await api(historyUrl(id), { method: 'PUT', body: request, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
        } catch (failure) {
          const status = (failure as { statusCode?: number }).statusCode

          if (status === 409 && readApiError(failure).code === 'history_conflict') throw new SyncConflict()

          // The session is gone: the work stays in the outbox, and after signing in it goes out on the next visit.
          if (status === 401 && current()) void navigateTo({ name: CoreRoutes.LOGIN })
          if (status !== undefined && REFUSED_STATUSES.has(status)) throw new SyncRejected()

          throw failure
        }
      },
      load: () => api<HistoryState>(historyUrl(id), { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }),
    }
  }

  /** Sends the small picture for the gallery card; best effort: a failure only means the next save tries again. */
  async function sendThumbnail() {
    const handle = stage.value
    const id = artId.value

    clearTimeout(thumbnailTimer)
    thumbnailTimer = undefined

    if (!thumbnailDue || !handle) return
    thumbnailDue = false
    thumbnailSentAt = Date.now()

    try {
      const image = await handle.exportThumbnail(THUMBNAIL_LONG_SIDE)

      await api(`/api/coloring/arts/${id}/thumbnail`, { method: 'PUT', body: image, headers: { 'content-type': image.type }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    } catch {
      thumbnailDue = true
    }
  }

  function scheduleThumbnail() {
    thumbnailDue = true

    if (thumbnailTimer !== undefined) return
    const wait = Math.max(THUMBNAIL_DELAY_MS, THUMBNAIL_MIN_INTERVAL_MS - (Date.now() - thumbnailSentAt))

    thumbnailTimer = setTimeout(() => void sendThumbnail(), wait)
  }

  /** Tells the interface what the history and the picture look like now. */
  function publish() {
    if (!timeline || !stage.value) return
    stage.value.publishProgress()
    editor.syncHistory(timeline.log)
    hooks.onChanged()
  }

  /** Stops saving for the current art; what is not saved yet stays in the outbox and goes out on the next visit. */
  function close() {
    generation++
    clearTimeout(thumbnailTimer)
    thumbnailTimer = undefined
    thumbnailDue = false
    const closing = sync

    // The picture's memory goes back at once; saving needs the history only.
    timeline?.dispose()
    sync = null
    timeline = null

    if (!closing) return
    // A last try to save; if it fails the outbox has the work. Nobody awaits it.
    void closing.persist()
      .then(() => closing.flush())
      .catch(() => undefined)
      .finally(() => closing.dispose())
  }

  /** Loads the art's history onto the blank canvas of the stage; call it when the stage reports it is ready. */
  async function open() {
    const handle = stage.value
    const id = artId.value

    if (!handle) return
    close()
    const mine = generation

    editor.historyReady = false
    loadError.value = ''

    let server: HistoryState

    try {
      server = await api<HistoryState>(historyUrl(id), { query: { track: 'open' } })
    } catch (failure) {
      if (isCurrent(mine)) loadError.value = readApiError(failure).message

      return
    }
    const unsent = await outbox.read(outboxKey(id))

    if (!isCurrent(mine)) return

    const opened = new Timeline(handle.paint)
    let result: Reconciliation

    try {
      result = await opened.open(server, unsent)
    } catch {
      opened.dispose()

      if (isCurrent(mine)) loadError.value = HISTORY_ERROR_MESSAGES.history_open

      return
    }

    if (!isCurrent(mine)) {
      opened.dispose()

      return
    }
    timeline = opened
    sync = new HistorySync({
      timeline: opened,
      api: syncApi(id, () => isCurrent(mine)),
      outbox,
      key: outboxKey(id),
      percent: () => editor.progress.percent,
      // A sync that was closed (the player left or opened another art) must not touch what is on screen now.
      onStatus: (status) => {
        if (!isCurrent(mine)) return
        editor.saveStatus = status

        if (status === 'saved') scheduleThumbnail()
      },
      onReconciled: (reconciliation) => {
        if (!isCurrent(mine)) return
        if (reconciliation.merged) hooks.notify(HISTORY_NOTICES.merged)
        else if (reconciliation.rebuild) hooks.notify(HISTORY_NOTICES.replaced)
        publish()
      },
      onRebuilding: (rebuilding) => {
        if (isCurrent(mine)) editor.rebuilding = rebuilding
      },
    })
    // The progress of what was loaded is reported while the editor still counts as "not ready", so a
    // picture that was already finished does not play its victory when it is opened.
    publish()
    editor.historyReady = true

    if (result.merged || opened.log.dirty) sync.changed()
  }

  function changed() {
    publish()
    sync?.changed()
  }

  /** A step the player just drew; `delta` is what it covered before, for an instant undo. */
  function record(step: HistoryStep, delta: PaintDelta | null) {
    if (!timeline) {
      if (delta) stage.value?.paint.discard(delta)

      return
    }
    timeline.record(step, delta)
    changed()
  }

  // Not while the picture is being rebuilt (opening, a conflict, starting over): the steps and the canvas are not in step then.
  function undo() {
    if (!editor.locked && timeline?.undo()) changed()
  }

  function redo() {
    if (!editor.locked && timeline?.redo()) changed()
  }

  /**
   * Starts the attempt over: what is unsent goes to the server first, so the old attempt stays
   * complete there, then the server starts the new one and its (empty) history is loaded.
   * Throws when something could not be done; the old attempt is then untouched.
   */
  async function startOver(restart: () => Promise<void>): Promise<boolean> {
    const id = artId.value
    const opened = timeline
    const saving = sync

    if (!opened || !saving) return false
    const mine = generation

    // Nothing may be drawn or undone from here until the new attempt is on the canvas.
    editor.restarting = true

    try {
      await saving.flush()

      // The player may have left while the unsent work was going out: nothing is started over then.
      if (!isCurrent(mine)) return false

      if (opened.log.dirty) {
        hooks.notify(HISTORY_ERROR_MESSAGES.history_unsaved)

        return false
      }
      await restart()
      const fresh = await api<HistoryState>(historyUrl(id))

      if (!isCurrent(mine) || artId.value !== id) return false
      await outbox.remove(outboxKey(id))
      await opened.load(fresh)
    } finally {
      // Another art's editor (opened meanwhile) has its own flag.
      if (isCurrent(mine)) editor.restarting = false
    }
    publish()

    return true
  }

  // The page going away: write the work down, try to send it, and warn when it would be lost.
  function onVisibility() {
    if (document.visibilityState === 'hidden') saveNow()
  }

  function saveNow() {
    if (!sync) return
    void sync.persist()
    void sync.flush()
  }

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (!timeline?.log.dirty) return
    event.preventDefault()
  }

  function onOnline() {
    sync?.retryNow()
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', saveNow)
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('online', onOnline)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', saveNow)
    window.removeEventListener('beforeunload', onBeforeUnload)
    window.removeEventListener('online', onOnline)
    // The picture is still on the stage: its last thumbnail is made now, before the stage goes away.
    void sendThumbnail()
    close()
  })

  watch(artId, close)

  // The gallery is the next screen: let what was drawn reach it, but never hold the player back for long.
  onBeforeRouteLeave(async () => {
    const settled = (async () => {
      await sync?.flush()
      await sendThumbnail()
    })()

    await Promise.race([settled, new Promise(resolve => setTimeout(resolve, LEAVE_WAIT_MS))])
  })

  return { loadError, open, record, undo, redo, startOver }
}
