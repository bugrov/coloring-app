import type { Ref } from 'vue'
import type { ColoringArt, Op, Tool } from '../../shared'
import {
  clampView,
  ColoringEngine,
  HOLD_DURATION_MS,
  HOLD_TOLERANCE_PX,
  HOLD_VIBRATION_MS,
  PAN_BUTTONS,
  HoldDetector,
  IDENTITY_VIEW,
  panBy,
  releaseCanvas,
  PINCH_MIN_DISTANCE_PX,
  WHEEL_LINE_HEIGHT_PX,
  WHEEL_PAN_MAX_DELTA_PX,
  WHEEL_ZOOM_MAX_DELTA_PX,
  WHEEL_ZOOM_SPEED,
  zoomAt,
  type PaintDelta,
  type PaintHost,
  type PaintSnapshot,
  type Progress,
  type SheetOrientation,
  type StrokeRecorder,
  type View,
} from '../engine'

export interface ColoringStageOptions {
  art: Ref<ColoringArt>
  tool: Ref<Tool>
  color: Ref<string>
  /** Paint opacity in percent. */
  opacity: Ref<number>
  /** Multiplier of the tool's line width. */
  thickness: Ref<number>
  /** Share of a region that counts it as coloured; read when the engine for an art is made. */
  tolerance?: Ref<number | undefined>
  /** Which way the sheet around the art is stretched; the picture is rebuilt when it changes. */
  orientation?: Ref<SheetOrientation>
  /** While true the player cannot draw (the picture is being rebuilt, or the history is full). */
  locked?: Ref<boolean>
  /** Feedback for a long press; position is in px relative to the stage. */
  onHold?: (feedback: HoldFeedback) => void
  /** A finished action; `delta` lets the history take it back without replaying (see `Timeline`). */
  onOps: (ops: Op[], delta: PaintDelta | null) => void
  /** A fresh engine is ready on a blank canvas (a new art, or the first one): the picture can be rebuilt. */
  onReady?: () => void
  onProgress: (progress: Progress) => void
}

export interface HoldFeedback {
  phase: 'start' | 'cancel' | 'fill'
  x: number
  y: number
  /** Null when the eraser clears the region. */
  color: string | null
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

export function createFrameStats(): FrameStats {
  return { last: 0, max: 0, average: 0, frames: 0 }
}

/** What `<ColoringStage>` exposes to its parent through a template ref. */
export interface ColoringStageHandle {
  stats: Readonly<FrameStats>
  resetView: () => void
  /** Rebuilds the picture from ops; drops a stroke in progress. For the sandbox, the editor uses `paint`. */
  replay: (ops: readonly Op[]) => void
  /** What the history (`Timeline`) needs from the picture; each call drops a stroke in progress. */
  paint: PaintHost<PaintSnapshot, PaintDelta>
  /** Reports the progress of the picture as it is now; call it after the history changed the picture. */
  publishProgress: () => void
  exportPng: () => Promise<Blob>
  /** A small image of the picture for the gallery card. */
  exportThumbnail: (longSide: number) => Promise<Blob>
  /** Whether a stroke is in progress (its pixels are not final yet). */
  isDrawing: () => boolean
}

interface ActiveStroke {
  pointerId: number
  pointerType: string
  recorder: StrokeRecorder
  /** Grid points received since the last frame. */
  queue: number[]
  /** Last point recorded, to drop repeats (a pen held still keeps sending moves). */
  last: [number, number]
}

interface Gesture {
  distance: number
  x: number
  y: number
}

/** Wheel delta in pixels whatever the device reports (pixels, lines or pages), capped per event. */
function wheelPixels(delta: number, mode: number, pageSize: number, cap: number): number {
  let pixels = delta

  switch (mode) {
    case WheelEvent.DOM_DELTA_LINE:
      pixels = delta * WHEEL_LINE_HEIGHT_PX
      break
    case WheelEvent.DOM_DELTA_PAGE:
      pixels = delta * pageSize
      break
  }

  return Math.max(-cap, Math.min(cap, pixels))
}

/** Whether a position given as a share of the sheet lies on it (a stage wider than the sheet leaves empty bands). */
function isOnSheet([rx, ry]: [number, number]): boolean {
  return rx >= 0 && rx <= 1 && ry >= 0 && ry <= 1
}

/**
 * Connects a {@link ColoringEngine} to the stage element: pointer input
 * (mouse, touch, pen), long press, two-finger zoom/pan, Ctrl+wheel zoom, right-button drag pan.
 * Input is collected per event and drawn once per animation frame; nothing
 * runs while the user is idle.
 */
export function useColoringStage({ stage, content, canvas }: ColoringStageElements, options: ColoringStageOptions) {
  const engine = shallowRef<ColoringEngine | null>(null)
  const view = ref<View>(IDENTITY_VIEW)
  const stats = createFrameStats()

  const pointers = new Map<number, { x: number, y: number, type: string }>()
  const hold = new HoldDetector(HOLD_TOLERANCE_PX)
  let stroke: ActiveStroke | null = null
  let gesture: Gesture | null = null
  /** A mouse drag with the right or middle button: moves the zoomed art, never draws. */
  let drag: { pointerId: number, x: number, y: number } | null = null
  let holdTimer: ReturnType<typeof setTimeout> | undefined
  /** Where the current press began, relative to the stage, and the colour it would fill with. */
  let holdAt: Pick<HoldFeedback, 'x' | 'y' | 'color'> = { x: 0, y: 0, color: null }
  let frame = 0
  /** Where the canvas is on the screen, kept while a stroke is drawn: reading it forces a layout, and the view only moves by gestures, the wheel or a resize. */
  let canvasRect: DOMRect | null = null
  let contentSize = { width: 0, height: 0 }

  watch([options.art, canvas, () => options.orientation?.value], ([art, element, orientation]) => {
    // The canvas is about to be rebuilt for another art: nothing of the old stroke is kept.
    discardStroke()
    engine.value?.dispose()
    engine.value = null

    if (!element) return
    engine.value = markRaw(new ColoringEngine(art, element, options.tolerance?.value, orientation))
    view.value = IDENTITY_VIEW
    Object.assign(stats, createFrameStats())
    // The content box changes with the art's proportions; remember it once laid out.
    nextTick(() => {
      rememberContentSize()
      options.onReady?.()
    })
    options.onProgress(engine.value.progress)
  }, { immediate: true })

  const contentStyle = computed(() => ({
    transform: `translate(${view.value.x}px, ${view.value.y}px) scale(${view.value.scale})`,
  }))

  /** Position as a share of the rendered sheet; `rect` is the canvas rect, which already includes zoom. */
  function ratioOf(event: { clientX: number, clientY: number }, rect: DOMRect): [number, number] {
    return [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height]
  }

  /** Content size and its untransformed top-left corner, in client pixels (transform origin is 0 0). */
  function contentBox() {
    const element = content.value!
    const rect = element.getBoundingClientRect()

    return { left: rect.left - view.value.x, top: rect.top - view.value.y, width: element.offsetWidth, height: element.offsetHeight }
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
    if (holdTimer !== undefined) options.onHold?.({ phase: 'cancel', ...holdAt })
    clearTimeout(holdTimer)
    holdTimer = undefined
    hold.cancel()
  }

  /** Takes the stroke back from the canvas. */
  function cancelStroke() {
    clearHoldTimer()
    stroke?.recorder.cancel()
    stroke = null
  }

  /**
   * Ends a stroke the user did not finish (second finger, system cancel).
   * Short strokes are taken back; a very long stroke that was already split
   * into ops is clearly intended and is kept whole.
   */
  function abortStroke() {
    if (stroke?.recorder.isSplit) finishStroke()
    else cancelStroke()
  }

  /** Forgets the stroke without touching the canvas, which is being replaced. */
  function discardStroke() {
    clearHoldTimer()
    stroke = null
  }

  /** Drops every tracked pointer; their pointerups were lost, so a stroke in progress was finished on purpose. */
  function forgetPointers() {
    finishStroke()
    pointers.clear()
    gesture = null
  }

  /** A pen arriving means any touches are a resting palm: drop them. */
  function dropTouches() {
    if (stroke?.pointerType === 'touch') abortStroke()

    for (const [id, pointer] of pointers) {
      if (pointer.type === 'touch') pointers.delete(id)
    }
    gesture = null
  }

  function commit(ops: Op[], delta: PaintDelta | null) {
    options.onOps(ops, delta)

    if (engine.value) options.onProgress(engine.value.progress)
  }

  function finishStroke() {
    if (!stroke) return
    flushStroke()
    clearHoldTimer()
    const { ops, delta } = stroke.recorder.finish()

    stroke = null

    // A stroke that changed nothing leaves no op: it is not a step of the history.
    if (ops.length > 0) commit(ops, delta)
  }

  function onHold() {
    holdTimer = undefined

    // A split stroke has moved far, so it cannot be a hold; checked for safety.
    if (!stroke || !hold.pending || !engine.value || stroke.recorder.isSplit) return
    const { recorder } = stroke

    recorder.cancel()
    stroke = null
    const { op, delta } = options.tool.value === 'eraser'
      ? engine.value.clear(recorder.region)
      : engine.value.fill(recorder.region, options.color.value, options.opacity.value)

    // A fill that changed nothing was taken back by the engine: no feedback, no step.
    if (!op) {
      options.onHold?.({ phase: 'cancel', ...holdAt })

      return
    }
    navigator.vibrate?.(HOLD_VIBRATION_MS)
    options.onHold?.({ phase: 'fill', ...holdAt })
    commit([op], delta)
  }

  function gestureSnapshot(): Gesture {
    const [a, b] = [...pointers.values()]

    return { distance: Math.hypot(b!.x - a!.x, b!.y - a!.y), x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 }
  }

  function updateGesture() {
    if (!gesture || pointers.size < 2) return
    const next = gestureSnapshot()
    const box = contentBox()
    const factor = gesture.distance < PINCH_MIN_DISTANCE_PX ? 1 : next.distance / gesture.distance
    const zoomed = zoomAt(view.value, factor, next.x - box.left, next.y - box.top, box.width, box.height)

    view.value = panBy(zoomed, next.x - gesture.x, next.y - gesture.y, box.width, box.height)
    canvasRect = null
    gesture = next
  }

  function onPointerDown(event: PointerEvent) {
    if (!engine.value) return
    if (event.pointerType === 'mouse' && event.button !== 0) {
      startDrag(event)

      return
    }
    // Palm rejection: while the pen draws, touches are ignored instead of starting
    // a gesture; a palm that landed before the pen is dropped when the pen arrives.
    if (stroke?.pointerType === 'pen' && event.pointerType !== 'pen') return
    if (event.pointerType === 'pen') dropTouches()
    // The same pointer pressing again means its pointerup was lost (e.g. the
    // mouse was released outside the window): commit what it drew first.
    if (stroke?.pointerId === event.pointerId) finishStroke()
    // A primary pointer starts a new contact, so every pointer still tracked
    // lost its pointerup; left in place they would lock the stage in gesture mode.
    if (event.isPrimary && pointers.size > 0 && !pointers.has(event.pointerId)) forgetPointers()

    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType })
    stage.value!.setPointerCapture(event.pointerId)

    if (pointers.size >= 2) {
      // A second finger means zoom/pan: take back what the first one drew.
      abortStroke()
      gesture = gestureSnapshot()

      return
    }

    // Zoom and pan stay possible while locked; drawing does not.
    if (options.locked?.value) return
    canvasRect = canvas.value!.getBoundingClientRect()
    const ratio = ratioOf(event, canvasRect)

    if (!isOnSheet(ratio)) return
    const { point, region } = engine.value.locate(...ratio)

    if (region === null) return
    const recorder = engine.value.beginStroke(region, options.tool.value, options.color.value, options.opacity.value, options.thickness.value)

    if (!recorder) return

    stroke = { pointerId: event.pointerId, pointerType: event.pointerType, recorder, queue: [...point], last: point }
    hold.start(event.clientX, event.clientY)
    holdTimer = setTimeout(onHold, HOLD_DURATION_MS)
    const stageRect = stage.value!.getBoundingClientRect()

    holdAt = { x: event.clientX - stageRect.left, y: event.clientY - stageRect.top, color: options.tool.value === 'eraser' ? null : options.color.value }
    options.onHold?.({ phase: 'start', ...holdAt })
    scheduleFrame()
  }

  function startDrag(event: PointerEvent) {
    // Only the right and the middle button pan; a stroke or another drag in progress is left alone.
    if (!PAN_BUTTONS.includes(event.button) || stroke || drag) return
    event.preventDefault()
    drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    stage.value!.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: PointerEvent) {
    if (!drag) return
    const box = contentBox()

    view.value = panBy(view.value, event.clientX - drag.x, event.clientY - drag.y, box.width, box.height)
    canvasRect = null
    drag.x = event.clientX
    drag.y = event.clientY
  }

  /** Ends the drag of this pointer; returns whether there was one. */
  function endDrag(event: PointerEvent): boolean {
    if (drag?.pointerId !== event.pointerId) return false
    drag = null

    return true
  }

  function onPointerMove(event: PointerEvent) {
    if (drag?.pointerId === event.pointerId) {
      moveDrag(event)

      return
    }
    if (!pointers.has(event.pointerId)) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType })

    if (gesture) {
      updateGesture()

      return
    }
    if (!stroke || stroke.pointerId !== event.pointerId || !engine.value) return

    const rect = canvasRect ??= canvas.value!.getBoundingClientRect()
    const coalesced = event.getCoalescedEvents?.()
    const { space } = engine.value

    for (const sample of coalesced?.length ? coalesced : [event]) {
      const point = space.gridFromRatio(...ratioOf(sample, rect))

      if (point[0] === stroke.last[0] && point[1] === stroke.last[1]) continue
      stroke.queue.push(...point)
      stroke.last = point
    }

    if (!hold.move(event.clientX, event.clientY)) clearHoldTimer()
    scheduleFrame()
  }

  /** Common bookkeeping when a pointer leaves; returns false for pointers we do not track. */
  function releasePointer(event: PointerEvent): boolean {
    if (!pointers.delete(event.pointerId)) return false
    if (gesture) {
      // Re-pair the remaining fingers; drawing resumes only after every finger is lifted.
      if (pointers.size >= 2) gesture = gestureSnapshot()
      else if (pointers.size === 0) gesture = null
    }

    return true
  }

  function onPointerUp(event: PointerEvent) {
    if (endDrag(event)) return
    if (releasePointer(event) && stroke?.pointerId === event.pointerId) finishStroke()
  }

  /** The system took the pointer away (edge swipe, rotation): the stroke was not finished on purpose. */
  function onPointerCancel(event: PointerEvent) {
    if (endDrag(event)) return
    if (releasePointer(event) && stroke?.pointerId === event.pointerId) abortStroke()
  }

  /**
   * Only the stage's own capture matters: lostpointercapture bubbles, and the
   * canvas loses its implicit touch capture as soon as the stage takes it.
   */
  function onLostCapture(event: PointerEvent) {
    if (event.target === stage.value) onPointerCancel(event)
  }

  function onWheel(event: WheelEvent) {
    const box = contentBox()

    canvasRect = null

    if (event.ctrlKey) {
      // Ctrl+wheel and trackpad pinch: zoom the art, not the page.
      event.preventDefault()
      const delta = wheelPixels(event.deltaY, event.deltaMode, box.height, WHEEL_ZOOM_MAX_DELTA_PX)

      view.value = zoomAt(view.value, Math.exp(-delta * WHEEL_ZOOM_SPEED), event.clientX - box.left, event.clientY - box.top, box.width, box.height)
    } else if (view.value.scale > 1) {
      event.preventDefault()
      const dx = wheelPixels(event.deltaX, event.deltaMode, box.width, WHEEL_PAN_MAX_DELTA_PX)
      const dy = wheelPixels(event.deltaY, event.deltaMode, box.height, WHEEL_PAN_MAX_DELTA_PX)

      view.value = panBy(view.value, -dx, -dy, box.width, box.height)
    }
  }

  function rememberContentSize() {
    const element = content.value

    if (element) contentSize = { width: element.offsetWidth, height: element.offsetHeight }
  }

  /** Keeps the same part of the art in view when the stage changes size (rotation, window resize). */
  function onResize() {
    const element = content.value

    if (!element) return
    const width = element.offsetWidth
    const height = element.offsetHeight
    const sx = contentSize.width ? width / contentSize.width : 1
    const sy = contentSize.height ? height / contentSize.height : 1

    contentSize = { width, height }
    canvasRect = null
    view.value = clampView({ ...view.value, x: view.value.x * sx, y: view.value.y * sy }, width, height)
  }

  const listeners = {
    pointerdown: onPointerDown,
    pointermove: onPointerMove,
    pointerup: onPointerUp,
    pointercancel: onPointerCancel,
    // Fires when capture is lost without pointerup/pointercancel (focus moved away, for example).
    lostpointercapture: onLostCapture,
  } satisfies Partial<Record<keyof HTMLElementEventMap, (event: PointerEvent) => void>>

  let resizeObserver: ResizeObserver | undefined

  onMounted(() => {
    const element = stage.value!

    for (const [type, listener] of Object.entries(listeners)) element.addEventListener(type, listener as EventListener)
    element.addEventListener('wheel', onWheel, { passive: false })
    resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(element)
  })

  onBeforeUnmount(() => {
    cancelAnimationFrame(frame)
    discardStroke()
    resizeObserver?.disconnect()
    const element = stage.value

    for (const [type, listener] of Object.entries(listeners)) element?.removeEventListener(type, listener as EventListener)
    element?.removeEventListener('wheel', onWheel)
    engine.value?.dispose()
    engine.value = null
  })

  /**
   * The engine, with a stroke in progress taken back: the picture is about to change under it, and
   * the pixels of a half-drawn stroke must not stay on it (an undo tapped by a second finger).
   */
  function ready(): ColoringEngine {
    const current = requireEngine()

    abortStroke()

    return current
  }

  function requireEngine(): ColoringEngine {
    if (!engine.value) throw new Error('Engine is not ready')

    return engine.value
  }

  const handle: ColoringStageHandle = {
    stats,
    resetView: () => {
      view.value = IDENTITY_VIEW
    },
    replay: (ops) => {
      if (!engine.value) return
      // The canvas is rebuilt: a stroke in progress would keep drawing over a stale base.
      discardStroke()
      engine.value.replay(ops)
      options.onProgress(engine.value.progress)
    },
    paint: {
      clear: () => ready().clearPaint(),
      apply: step => ready().applyOps(step),
      settle: () => ready().settle(),
      snapshot: () => ready().snapshot(),
      restore: snapshot => ready().restore(snapshot),
      // Freed whether or not the engine is still there: the history lets go of them while the stage goes away.
      release: snapshot => releaseCanvas(snapshot.canvas),
      capture: step => ready().captureBefore(step),
      swap: delta => ready().swapDelta(delta),
      discard: delta => releaseCanvas(delta.canvas),
      cost: delta => delta.rect.width * delta.rect.height,
    },
    publishProgress: () => {
      if (engine.value) options.onProgress(engine.value.progress)
    },
    exportThumbnail: async longSide => requireEngine().exportThumbnail(longSide),
    exportPng: async () => requireEngine().exportPng(),
    isDrawing: () => stroke !== null,
  }

  return { contentStyle, handle }
}
