import type { Ref } from 'vue'
import type { ColoringArt, Op, Tool } from '../../shared'
import {
  clampView,
  ColoringEngine,
  HOLD_DURATION_MS,
  HOLD_TOLERANCE_PX,
  HoldDetector,
  IDENTITY_VIEW,
  panBy,
  WHEEL_ZOOM_SPEED,
  zoomAt,
  type Progress,
  type StrokeRecorder,
  type View,
} from '../engine'

export interface ColoringStageOptions {
  art: Ref<ColoringArt>
  tool: Ref<Tool>
  color: Ref<string>
  onOps: (ops: Op[]) => void
  onProgress: (progress: Progress) => void
}

export interface ColoringStageElements {
  stage: Ref<HTMLElement | null>
  content: Ref<HTMLElement | null>
  canvas: Ref<HTMLCanvasElement | null>
}

/** Timing of the drawing work per animation frame, for the performance budget. */
export interface FrameStats {
  last: number
  max: number
  /** Running average over all drawn frames. */
  average: number
  frames: number
}

/** What `<ColoringStage>` exposes to its parent through a template ref. */
export interface ColoringStageHandle {
  stats: Readonly<FrameStats>
  resetView: () => void
  /** Rebuilds the picture from ops (undo/redo, restoring a session). */
  replay: (ops: readonly Op[]) => void
  exportPng: () => Promise<Blob>
}

interface ActiveStroke {
  pointerId: number
  recorder: StrokeRecorder
  /** Grid points received since the last frame. */
  queue: number[]
}

/**
 * Connects a {@link ColoringEngine} to the stage element: pointer input
 * (mouse, touch, pen), long press, two-finger zoom/pan, Ctrl+wheel zoom.
 * Input is collected per event and drawn once per animation frame; nothing
 * runs while the user is idle.
 */
export function useColoringStage({ stage, content, canvas }: ColoringStageElements, options: ColoringStageOptions) {
  const engine = shallowRef<ColoringEngine | null>(null)
  const view = ref<View>(IDENTITY_VIEW)
  const stats: FrameStats = { last: 0, max: 0, average: 0, frames: 0 }

  const pointers = new Map<number, { x: number, y: number }>()
  const hold = new HoldDetector(HOLD_TOLERANCE_PX)
  let stroke: ActiveStroke | null = null
  let gesture: { distance: number, x: number, y: number } | null = null
  let holdTimer: ReturnType<typeof setTimeout> | undefined
  let frame = 0

  watch([options.art, canvas], ([art, element]) => {
    cancelStroke()
    if (!element) return
    engine.value = markRaw(new ColoringEngine(art, element))
    view.value = IDENTITY_VIEW
    options.onProgress(engine.value.progress)
  }, { immediate: true })

  const contentStyle = computed(() => ({
    transform: `translate(${view.value.x}px, ${view.value.y}px) scale(${view.value.scale})`,
  }))

  /** Position as a share of the rendered art; the canvas rect already includes zoom. */
  function ratioOf(event: { clientX: number, clientY: number }): [number, number] {
    const rect = canvas.value!.getBoundingClientRect()
    return [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height]
  }

  /** Content size and its untransformed top-left corner, in client pixels. */
  function contentBox() {
    const element = content.value!
    const stageRect = stage.value!.getBoundingClientRect()
    return {
      left: stageRect.left + element.offsetLeft,
      top: stageRect.top + element.offsetTop,
      width: element.offsetWidth,
      height: element.offsetHeight,
    }
  }

  function scheduleFrame() {
    if (!frame) frame = requestAnimationFrame(drawFrame)
  }

  function drawFrame() {
    frame = 0
    const started = performance.now()
    if (!flushStroke()) return
    stats.last = performance.now() - started
    stats.max = Math.max(stats.max, stats.last)
    stats.frames++
    stats.average += (stats.last - stats.average) / stats.frames
  }

  /** Draws the queued points; returns whether there was anything to draw. */
  function flushStroke(): boolean {
    if (!stroke || stroke.queue.length === 0) return false
    stroke.recorder.add(stroke.queue)
    stroke.queue = []
    return true
  }

  function clearHoldTimer() {
    clearTimeout(holdTimer)
    holdTimer = undefined
    hold.cancel()
  }

  function cancelStroke() {
    clearHoldTimer()
    stroke?.recorder.cancel()
    stroke = null
  }

  function finishStroke() {
    if (!stroke || !engine.value) return
    flushStroke()
    clearHoldTimer()
    const ops = stroke.recorder.finish()
    stroke = null
    options.onOps(ops)
    options.onProgress(engine.value.progress)
  }

  function onHold() {
    holdTimer = undefined
    if (!stroke || !hold.pending || !engine.value) return
    const { recorder } = stroke
    recorder.cancel()
    stroke = null
    const op = options.tool.value === 'eraser'
      ? engine.value.clear(recorder.region)
      : engine.value.fill(recorder.region, options.color.value)
    navigator.vibrate?.(15)
    options.onOps([op])
    options.onProgress(engine.value.progress)
  }

  function gestureSnapshot() {
    const [a, b] = [...pointers.values()]
    return { distance: Math.hypot(b!.x - a!.x, b!.y - a!.y), x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 }
  }

  function updateGesture() {
    if (!gesture || pointers.size < 2) return
    const next = gestureSnapshot()
    const box = contentBox()
    const zoomed = zoomAt(view.value, next.distance / gesture.distance, next.x - box.left, next.y - box.top, box.width, box.height)
    view.value = panBy(zoomed, next.x - gesture.x, next.y - gesture.y, box.width, box.height)
    gesture = next
  }

  function onPointerDown(event: PointerEvent) {
    if (!engine.value || (event.pointerType === 'mouse' && event.button !== 0)) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    stage.value!.setPointerCapture(event.pointerId)

    if (pointers.size === 2) {
      // A second finger means zoom/pan: take back what the first one drew.
      cancelStroke()
      gesture = gestureSnapshot()
      return
    }
    if (pointers.size > 2 || gesture) return

    const { point, region } = engine.value.locate(...ratioOf(event))
    if (region === null) return
    const recorder = engine.value.beginStroke(region, options.tool.value, options.color.value)
    if (!recorder) return

    stroke = { pointerId: event.pointerId, recorder, queue: [...point] }
    hold.start(event.clientX, event.clientY)
    holdTimer = setTimeout(onHold, HOLD_DURATION_MS)
    scheduleFrame()
  }

  function onPointerMove(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (gesture) {
      updateGesture()
      return
    }
    if (!stroke || stroke.pointerId !== event.pointerId || !engine.value) return

    const coalesced = event.getCoalescedEvents?.()
    const space = engine.value.space
    for (const sample of coalesced?.length ? coalesced : [event]) {
      const [x, y] = space.gridFromRatio(...ratioOf(sample))
      const { queue } = stroke
      if (queue[queue.length - 2] !== x || queue[queue.length - 1] !== y) queue.push(x, y)
    }
    if (!hold.move(event.clientX, event.clientY)) clearHoldTimer()
    scheduleFrame()
  }

  function onPointerUp(event: PointerEvent) {
    if (!pointers.delete(event.pointerId)) return
    if (gesture) {
      // Drawing resumes only after every finger of the gesture is lifted.
      if (pointers.size === 0) gesture = null
      return
    }
    if (stroke?.pointerId === event.pointerId) finishStroke()
  }

  function onWheel(event: WheelEvent) {
    const box = contentBox()
    if (event.ctrlKey) {
      // Ctrl+wheel and trackpad pinch: zoom the art, not the page.
      event.preventDefault()
      view.value = zoomAt(view.value, Math.exp(-event.deltaY * WHEEL_ZOOM_SPEED), event.clientX - box.left, event.clientY - box.top, box.width, box.height)
    }
    else if (view.value.scale > 1) {
      event.preventDefault()
      view.value = panBy(view.value, -event.deltaX, -event.deltaY, box.width, box.height)
    }
  }

  function onResize() {
    const element = content.value
    if (element) view.value = clampView(view.value, element.offsetWidth, element.offsetHeight)
  }

  let resizeObserver: ResizeObserver | undefined
  onMounted(() => {
    const element = stage.value!
    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('pointerup', onPointerUp)
    element.addEventListener('pointercancel', onPointerUp)
    element.addEventListener('wheel', onWheel, { passive: false })
    resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(element)
  })

  onBeforeUnmount(() => {
    cancelAnimationFrame(frame)
    cancelStroke()
    resizeObserver?.disconnect()
    const element = stage.value
    element?.removeEventListener('pointerdown', onPointerDown)
    element?.removeEventListener('pointermove', onPointerMove)
    element?.removeEventListener('pointerup', onPointerUp)
    element?.removeEventListener('pointercancel', onPointerUp)
    element?.removeEventListener('wheel', onWheel)
  })

  return {
    engine,
    contentStyle,
    stats,
    resetView: () => {
      view.value = IDENTITY_VIEW
    },
  }
}
