import type { ColoringStageHandle } from './useColoringStage'

/** Idle time after the last change before the share image is re-rendered. */
const EXPORT_IDLE_MS = 800

/**
 * Keeps a PNG of the picture ready ahead of time, since Safari only allows sharing
 * synchronously inside the click. Call `prepare()` after every change; `share()` uses the ready
 * image, or renders one when the player is quicker than the idle delay.
 */
export function useShareImage(stage: Readonly<Ref<ColoringStageHandle | null>>, fileName: () => string) {
  let preparedPng: Blob | null = null
  let exportTimer: ReturnType<typeof setTimeout> | undefined
  /** Bumped on every change; an export finishing for an older generation is stale. */
  let generation = 0

  function prepare() {
    clearTimeout(exportTimer)
    preparedPng = null
    const current = ++generation

    exportTimer = setTimeout(() => {
      // A stroke in progress may still be taken back: wait until the picture is final.
      if (stage.value?.isDrawing()) {
        prepare()

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

  async function share() {
    const png = preparedPng ?? await stage.value?.exportPng()

    if (png) await shareOrDownload(png, `${fileName()}-${new Date().toISOString().slice(0, 10)}.png`)
  }

  onBeforeUnmount(() => clearTimeout(exportTimer))

  return { prepare, share }
}
