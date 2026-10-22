import { readApiError } from '#layers/core/shared/errors'
import type { ArtDetails, Op } from '../../shared'
import type { PaintDelta, Progress } from '../engine'
import { HISTORY_ERROR_MESSAGES } from '../../shared'
import { useEditorStore } from '../stores/editor'
import { useEditorHistory } from './useEditorHistory'
import type { ColoringStageHandle } from './useColoringStage'
import { useShareImage } from './useShareImage'

/** How long a failure message stays on screen. */
const NOTICE_MS = 5000
/** How long the congratulation card stays on screen. */
const CONGRATS_MS = 4500

/**
 * Everything the editor page needs besides markup: the art from the server, the player's
 * choices (the editor store), history glue to the engine, restart and share.
 */
export function useColoringEditor(artId: Readonly<Ref<string>>, stage: Readonly<Ref<ColoringStageHandle | null>>) {
  const editor = useEditorStore()
  const api = useApi()

  const { data, error, refresh } = useFetch<ArtDetails>(() => `/api/coloring/arts/${artId.value}`, { timeout: API_TIMEOUT_MS, key: () => `coloring-art-${artId.value}` })
  const art = computed(() => data.value?.art ?? null)
  const title = computed(() => data.value?.title ?? '')
  /** Share of a region that counts it as coloured (the administrator's setting). */
  const tolerance = computed(() => data.value?.tolerance)

  // The colours of the panel come with the art, as the administrator set them.
  watch(() => data.value?.palette, (colors) => {
    if (colors) editor.setPalette(colors)
  }, { immediate: true })

  /** Why the art is not shown: the message for the player, or empty while it loads or is ready. */
  const loadError = computed(() => (error.value ? readApiError(error.value).message : ''))

  watch(artId, () => editor.open(), { immediate: true })

  const { prepare: prepareShare, share } = useShareImage(stage, () => `coloring-${artId.value}`)
  /** Message of the last failed action (restart, share), or empty. */
  const notice = ref('')
  let noticeTimer: ReturnType<typeof setTimeout> | undefined

  function showNotice(message: string) {
    notice.value = message
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => {
      notice.value = ''
    }, NOTICE_MS)
  }
  onBeforeUnmount(() => clearTimeout(noticeTimer))

  /** True while a restart request is in flight. */
  const restarting = ref(false)

  /** Set when the last stroke completed the picture; the frame plays its celebration once. */
  const celebrating = ref(false)
  /** The congratulation card; it goes away by itself, or at once if the picture is no longer complete. */
  const congratulating = ref(false)
  let congratsTimer: ReturnType<typeof setTimeout> | undefined

  // Runs the moment the progress changes (not on the next tick), so it can tell a finished picture that
  // is being opened or rebuilt from one the player has just finished.
  watch(() => editor.progress.complete, (complete, was) => {
    clearTimeout(congratsTimer)

    if (!editor.historyReady || editor.rebuilding) {
      congratulating.value = false

      return
    }
    congratulating.value = complete

    if (!complete) return
    if (!was) celebrating.value = true
    congratsTimer = setTimeout(() => {
      congratulating.value = false
    }, CONGRATS_MS)
  }, { flush: 'sync' })
  onBeforeUnmount(() => clearTimeout(congratsTimer))

  const history = useEditorHistory(artId, stage, { onChanged: prepareShare, notify: showNotice })

  function onProgress(progress: Progress) {
    editor.progress = progress
  }

  // The player cannot go on drawing in a history that is full; say why, once.
  watch(() => editor.historyFull, (full) => {
    if (full) showNotice(HISTORY_ERROR_MESSAGES.history_full)
  })

  /** Starts the art over; the server keeps the old attempt (it is shown in the gallery as a new empty card state). */
  async function restart(): Promise<boolean> {
    notice.value = ''
    const id = artId.value

    restarting.value = true

    try {
      // Unsaved work goes out first; when the player moved on to another art meanwhile its picture is not ours to reset.
      const done = await history.startOver(async () => {
        await api(`/api/coloring/arts/${id}/restart`, { method: 'POST' })
      })

      if (done) celebrating.value = false

      return done
    } catch (failure) {
      showNotice(readApiError(failure).message)

      return false
    } finally {
      restarting.value = false
    }
  }

  async function shareImage() {
    notice.value = ''

    try {
      await share()
    } catch {
      showNotice('Не получилось сохранить картинку. Попробуйте ещё раз.')
    }
  }

  return {
    art,
    title,
    tolerance,
    loadError,
    retry: refresh,
    historyError: history.loadError,
    retryHistory: history.open,
    notice,
    restarting,
    celebrating,
    congratulating,
    onStageReady: history.open,
    onOps: (ops: Op[], delta: PaintDelta | null) => history.record(ops, delta),
    onProgress,
    undo: history.undo,
    redo: history.redo,
    restart,
    shareImage,
  }
}
