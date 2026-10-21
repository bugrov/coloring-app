import { convertSvg, DEFAULT_COLOR } from '../../shared'
import type { ColoringArt, Op, Tool } from '../../shared'
import { EMPTY_PROGRESS, type Progress } from '../engine'
import { createFrameStats, type ColoringStageHandle, type FrameStats } from './useColoringStage'

/** Idle time after the last change before the share image is re-rendered. */
const EXPORT_IDLE_MS = 800

/**
 * State of the developer sandbox: the built-in arts, the current tool and
 * colour, the op log (to check that replay rebuilds the same picture) and a
 * share image prepared ahead of time, since Safari only shares synchronously.
 */
export function useColoringSandbox(stage: Readonly<Ref<ColoringStageHandle | null>>) {
  const arts = Object.entries(BASE_ART_SAMPLES).flatMap(([name, source]) => {
    const result = convertSvg(source)
    return result.ok ? [{ name, art: result.art }] : []
  })

  const artName = ref(arts[0]!.name)
  const art = computed<ColoringArt>(() => arts.find(entry => entry.name === artName.value)!.art)
  const tool = ref<Tool>('pencil')
  const color = ref(DEFAULT_COLOR)
  const ops = shallowRef<Op[]>([])
  const progress = ref<Progress>({ ...EMPTY_PROGRESS })
  const frameStats = ref<FrameStats>(createFrameStats())

  let preparedPng: Blob | null = null
  let exportTimer: ReturnType<typeof setTimeout> | undefined
  /** Bumped on every change; an export finishing for an older generation is stale. */
  let generation = 0

  function prepareExport() {
    clearTimeout(exportTimer)
    preparedPng = null
    const current = ++generation
    exportTimer = setTimeout(() => {
      // A stroke in progress may still be taken back: wait until the picture is final.
      if (stage.value?.isDrawing()) {
        prepareExport()
        return
      }
      stage.value?.exportPng()
        .then((png) => {
          if (current === generation) preparedPng = png
        })
        .catch(() => {
          // Share renders on demand when no prepared image is available.
        })
    }, EXPORT_IDLE_MS)
  }

  /** Shows the stage's frame timings (reset per art); refreshed after strokes, nothing polls in idle. */
  function refreshStats() {
    if (stage.value) frameStats.value = { ...stage.value.stats }
  }

  watch(artName, () => {
    ops.value = []
    prepareExport()
    nextTick(refreshStats)
  })

  function onProgress(value: Progress) {
    progress.value = value
  }

  function addOps(newOps: Op[]) {
    ops.value = [...ops.value, ...newOps]
    refreshStats()
    prepareExport()
  }

  function replay() {
    stage.value?.replay(ops.value)
  }

  function clear() {
    ops.value = []
    stage.value?.replay([])
    prepareExport()
  }

  async function share() {
    const png = preparedPng ?? await stage.value?.exportPng()
    if (png) await shareOrDownload(png, `coloring-${artName.value}-${new Date().toISOString().slice(0, 10)}.png`)
  }

  onBeforeUnmount(() => clearTimeout(exportTimer))

  return { arts, artName, art, tool, color, ops, progress, frameStats, addOps, onProgress, replay, clear, share }
}
