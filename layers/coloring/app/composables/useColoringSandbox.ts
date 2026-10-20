import { convertSvg, PALETTE } from '../../shared'
import type { ColoringArt, Op, Tool } from '../../shared'
import type { Progress } from '../engine'
import type { ColoringStageHandle, FrameStats } from './useColoringStage'

/** Idle time after the last change before the share image is re-rendered. */
const EXPORT_IDLE_MS = 800
const STATS_INTERVAL_MS = 500

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
  const color = ref(PALETTE[1]!.hex)
  const ops = shallowRef<Op[]>([])
  const progress = ref<Progress>({ percent: 0, complete: false })
  const frameStats = ref<FrameStats>({ last: 0, max: 0, average: 0, frames: 0 })

  let preparedPng: Blob | null = null
  let exportTimer: ReturnType<typeof setTimeout> | undefined

  function prepareExport() {
    clearTimeout(exportTimer)
    preparedPng = null
    exportTimer = setTimeout(async () => {
      preparedPng = await stage.value?.exportPng() ?? null
    }, EXPORT_IDLE_MS)
  }

  watch(artName, () => {
    ops.value = []
    prepareExport()
  })

  function addOps(newOps: Op[]) {
    ops.value = [...ops.value, ...newOps]
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

  const statsTimer = setInterval(() => {
    if (stage.value) frameStats.value = { ...stage.value.stats }
  }, STATS_INTERVAL_MS)
  onBeforeUnmount(() => {
    clearInterval(statsTimer)
    clearTimeout(exportTimer)
  })

  return { arts, artName, art, tool, color, ops, progress, frameStats, addOps, replay, clear, share }
}
