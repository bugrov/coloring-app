import { convertSvg, DEFAULT_COLOR } from '../../shared'
import type { ColoringArt, Op, Tool } from '../../shared'
import { EMPTY_PROGRESS, type Progress } from '../engine'
import { createFrameStats, type ColoringStageHandle, type FrameStats } from './useColoringStage'
import { useShareImage } from './useShareImage'

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

  const { prepare: prepareExport, share } = useShareImage(stage, () => `coloring-${artName.value}`)

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

  return { arts, artName, art, tool, color, ops, progress, frameStats, addOps, onProgress, replay, clear, share }
}
