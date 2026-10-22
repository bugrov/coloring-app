import { readApiError } from '#layers/core/shared/errors'
import type { ColoringArt, HistoryState } from '../../shared'
import { Timeline, type PaintDelta, type PaintSnapshot } from '../engine'
import type { ColoringStageHandle } from './useColoringStage'

interface PlayerArtState {
  title: string
  art: ColoringArt
  history: HistoryState
}

/** Pause after the slider moves before the picture is rebuilt for it, so dragging does not replay on every pixel. */
const SLIDER_DELAY_MS = 150

/**
 * The picture of one attempt of a player, for the administrator to look at: the history is loaded
 * from the server and replayed on a read-only stage up to the step the slider shows. Nothing is
 * saved or changed.
 */
export function usePlayerArtView(
  playerId: Readonly<Ref<string>>,
  artId: Readonly<Ref<string>>,
  attempt: Readonly<Ref<number | undefined>>,
  stage: Readonly<Ref<ColoringStageHandle | null>>,
) {
  const { data, error } = useFetch<PlayerArtState>(
    () => `/api/admin/coloring/players/${playerId.value}/arts/${artId.value}`,
    { query: computed(() => ({ attempt: attempt.value })), key: () => `admin-coloring-view-${playerId.value}-${artId.value}-${attempt.value ?? 'latest'}` },
  )

  const state = computed(() => data.value)
  const loadError = computed(() => (error.value ? readApiError(error.value).message : ''))
  /** How many steps the picture shows; the history's own cursor until the slider is moved. */
  const step = ref(0)
  const total = computed(() => state.value?.history.steps.length ?? 0)
  const stageReady = ref(false)
  const rebuilding = ref(false)

  let timeline: Timeline<PaintSnapshot, PaintDelta> | null = null
  let pending: ReturnType<typeof setTimeout> | undefined
  let generation = 0

  async function show() {
    const current = state.value
    const handle = stage.value
    if (!current || !handle || !stageReady.value) return
    const mine = ++generation
    rebuilding.value = true
    timeline?.dispose()
    timeline = new Timeline(handle.paint)
    try {
      await timeline.load({ ...current.history, cursor: step.value })
    }
    finally {
      if (mine === generation) rebuilding.value = false
    }
    if (mine === generation) handle.publishProgress()
  }

  watch(state, (value) => {
    if (value) step.value = value.history.cursor
  }, { immediate: true })

  // A new art or attempt makes a new engine on the stage; the picture is rebuilt when it reports ready.
  watch([state, stageReady], () => void show())
  watch(step, () => {
    clearTimeout(pending)
    pending = setTimeout(() => void show(), SLIDER_DELAY_MS)
  })

  onBeforeUnmount(() => {
    generation++
    clearTimeout(pending)
    timeline?.dispose()
  })

  return {
    state,
    loadError,
    step,
    total,
    rebuilding,
    onStageReady: () => {
      stageReady.value = false
      // The stage made a new engine: the picture that was on it is gone, rebuild it.
      nextTick(() => {
        stageReady.value = true
      })
    },
  }
}
