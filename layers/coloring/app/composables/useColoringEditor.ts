import { readApiError } from '#layers/core/shared/errors'
import type { ArtDetails, Op } from '../../shared'
import type { Progress } from '../engine'
import { useEditorStore } from '../stores/editor'
import type { ColoringStageHandle } from './useColoringStage'
import { useShareImage } from './useShareImage'

/** How long a failure message stays on screen. */
const NOTICE_MS = 5000

/**
 * Everything the editor page needs besides markup: the art from the server, the player's
 * choices (the editor store), history glue to the engine, restart and share.
 */
export function useColoringEditor(artId: Readonly<Ref<string>>, stage: Readonly<Ref<ColoringStageHandle | null>>) {
  const editor = useEditorStore()
  const api = useRequestFetch()

  const { data, status, error, refresh } = useFetch<ArtDetails>(() => `/api/coloring/arts/${artId.value}`, { key: () => `coloring-art-${artId.value}` })
  const art = computed(() => data.value?.art ?? null)
  const title = computed(() => data.value?.title ?? '')

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

  /** Set when the last stroke completed the picture; the frame plays its celebration once. */
  const celebrating = ref(false)
  watch(() => editor.progress.complete, (complete, was) => {
    if (complete && !was) celebrating.value = true
  })

  function onOps(ops: Op[]) {
    editor.record(ops)
    prepareShare()
  }

  function onProgress(progress: Progress) {
    editor.progress = progress
  }

  /** Rebuilds the picture from the steps that are applied now. A stroke in progress is dropped by the stage. */
  function rebuild() {
    stage.value?.replay(editor.activeOps)
    prepareShare()
  }

  function undo() {
    if (editor.undo()) rebuild()
  }

  function redo() {
    if (editor.redo()) rebuild()
  }

  /** Starts the art over; the server keeps the old attempt (it is shown in the gallery as a new empty card state). */
  async function restart(): Promise<boolean> {
    notice.value = ''
    try {
      await api(`/api/coloring/arts/${artId.value}/restart`, { method: 'POST' })
    }
    catch (failure) {
      showNotice(readApiError(failure).message)
      return false
    }
    editor.resetPicture()
    celebrating.value = false
    rebuild()
    return true
  }

  async function shareImage() {
    notice.value = ''
    try {
      await share()
    }
    catch {
      showNotice('Не получилось сохранить картинку. Попробуйте ещё раз.')
    }
  }

  return { art, title, status, loadError, retry: refresh, notice, celebrating, onOps, onProgress, undo, redo, restart, shareImage }
}
