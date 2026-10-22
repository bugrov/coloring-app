import { DEFAULT_OPACITY, MAX_STROKE_POINTS } from '../../shared'
import type { ClearOp, ColoringArt, FillOp, Op, StrokeOp, Tool } from '../../shared'
import { unionRect, type AnyCanvas, type Rect } from './canvas'
import { DEFAULT_THICKNESS, TOOL_WIDTH } from './constants'
import { exportPng, exportThumbnail } from './export'
import { ArtGeometry } from './geometry'
import { Painter, type PaintDelta, type PaintStroke, type StrokeStyle } from './painter'
import { ProgressTracker, type Progress, type ProgressState } from './progress'
import { ArtSpace, gridLength } from './space'

export {
  DEFAULT_THICKNESS,
  HOLD_DURATION_MS,
  HOLD_TOLERANCE_PX,
  HOLD_VIBRATION_MS,
  PAN_BUTTONS,
  PINCH_MIN_DISTANCE_PX,
  THICKNESS_SCALES,
  WHEEL_LINE_HEIGHT_PX,
  WHEEL_PAN_MAX_DELTA_PX,
  WHEEL_ZOOM_MAX_DELTA_PX,
  WHEEL_ZOOM_SPEED,
} from './constants'
export { releaseCanvas } from './canvas'
export { HoldDetector } from './hold'
export type { PaintDelta } from './painter'
export { EMPTY_PROGRESS, type Progress } from './progress'
export { Timeline, type PaintHost } from './timeline'
export { clampView, IDENTITY_VIEW, panBy, zoomAt, type View } from './viewport'

/**
 * The colouring engine for one art: hit testing, drawing, progress and
 * export. It knows nothing about the DOM beyond the paint canvas and turns
 * every user action into an {@link Op}; replaying the ops rebuilds the image.
 *
 * Deliberately not reactive: it lives outside Vue's reactivity (markRaw) so
 * the drawing hot path never triggers watchers.
 */
/** A copy of the picture and of its progress counts; see `ColoringEngine.snapshot`. */
export interface PaintSnapshot {
  readonly canvas: AnyCanvas
  readonly progress: ProgressState
}

export class ColoringEngine {
  private unsettled: Rect | null = null
  readonly space: ArtSpace
  private readonly geometry: ArtGeometry
  private readonly painter: Painter
  private readonly tracker: ProgressTracker

  /** `tolerance`: the share of a region that counts it as coloured (the administrator can change it). */
  constructor(art: ColoringArt, canvas: HTMLCanvasElement, tolerance?: number) {
    this.space = new ArtSpace(art)
    this.geometry = new ArtGeometry(art, this.space)
    this.painter = new Painter(canvas, this.space, this.geometry)
    this.tracker = new ProgressTracker(this.space, this.geometry, tolerance)
  }

  /** Grid point and region under a position given as a share (0–1) of the rendered art. */
  locate(rx: number, ry: number): { point: [number, number], region: number | null } {
    const point = this.space.gridFromRatio(rx, ry)
    const [x, y] = this.space.gridToArt(...point)

    return { point, region: this.geometry.hitTest(x, y)?.id ?? null }
  }

  /**
   * `opacity` is a percent; it is not recorded at full opacity or for the eraser. `thickness`
   * multiplies the tool's line width.
   */
  beginStroke(region: number, tool: Tool, color: string, opacity = DEFAULT_OPACITY, thickness = DEFAULT_THICKNESS): StrokeRecorder | null {
    const style: StrokeStyle = { tool, color: tool === 'eraser' ? null : color, width: gridLength(TOOL_WIDTH[tool] * thickness) }

    if (tool !== 'eraser' && opacity !== DEFAULT_OPACITY) style.opacity = opacity
    const stroke = this.painter.beginStroke(region, style, true)

    return stroke ? new StrokeRecorder(region, stroke, rect => this.track(rect), rect => this.painter.captureBackup(rect)) : null
  }

  /** Fills the region; the delta is what was there before (null for an unknown region). */
  fill(region: number, color: string, opacity = DEFAULT_OPACITY): { op: FillOp, delta: PaintDelta | null } {
    const op: FillOp = opacity === DEFAULT_OPACITY ? { type: 'fill', region, color } : { type: 'fill', region, color, opacity }
    const delta = this.painter.captureRegions([region])

    this.track(this.painter.apply(op))

    return { op, delta }
  }

  clear(region: number): { op: ClearOp, delta: PaintDelta | null } {
    const op: ClearOp = { type: 'clear', region }
    const delta = this.painter.captureRegions([region])

    this.track(this.painter.apply(op))

    return { op, delta }
  }

  /** Rebuilds the paint from scratch; the basis for undo/redo and restoring a session. */
  replay(ops: readonly Op[]) {
    this.painter.clearAll()

    for (const op of ops) this.painter.apply(op)
    this.track(this.painter.fullRect)
  }

  /**
   * Applies ops on top of what is painted. The progress is measured once for all of them, by
   * `settle`: reading the canvas back is the costly part, and a replay of many steps would do it
   * for every one.
   */
  applyOps(ops: readonly Op[]) {
    for (const op of ops) this.unsettled = unionRect(this.unsettled, this.painter.apply(op))
  }

  /** Measures the progress of what `applyOps` painted since the last call. */
  settle() {
    this.track(this.unsettled)
    this.unsettled = null
  }

  /** What the picture shows where `ops` are about to paint: the delta that takes them back. */
  captureBefore(ops: readonly Op[]): PaintDelta | null {
    return this.painter.captureRegions(ops.map(op => op.region))
  }

  /** Exchanges a step's saved pixels with the picture (see `Painter.swapRect`); settled with the progress by `settle`. */
  swapDelta(delta: PaintDelta) {
    this.unsettled = unionRect(this.unsettled, this.painter.swapRect(delta))
  }

  /** A blank picture. */
  clearPaint() {
    this.painter.clearAll()
    this.tracker.reset()
    this.unsettled = null
  }

  /** The picture as it is now, to come back to without replaying the steps that led to it. */
  snapshot(): PaintSnapshot {
    const canvas = this.painter.createSnapshotCanvas()

    this.painter.copyPaintTo(canvas)

    return { canvas, progress: this.tracker.saveState() }
  }

  restore(snapshot: PaintSnapshot) {
    this.painter.restorePaintFrom(snapshot.canvas)
    this.tracker.restoreState(snapshot.progress)
  }

  get progress(): Progress {
    return this.tracker.progress
  }

  exportPng(): Promise<Blob> {
    return exportPng(this.space, this.geometry, this.painter.canvas)
  }

  /** A small image of the picture for the gallery, `longSide` pixels along its long side. */
  exportThumbnail(longSide: number): Promise<Blob> {
    return exportThumbnail(this.space, this.geometry, this.painter.canvas, longSide)
  }

  /** Releases the offscreen canvases right away; iOS limits total canvas memory. */
  dispose() {
    this.painter.dispose()
  }

  private track(rect: Rect | null) {
    if (rect) this.tracker.update(this.painter.canvas, rect)
  }
}

/**
 * Records a live stroke and turns it into ops. Strokes longer than
 * MAX_STROKE_POINTS are split while drawing, so every op replays exactly as
 * the user saw it.
 */
export class StrokeRecorder {
  private readonly completed: StrokeOp[] = []

  constructor(
    readonly region: number,
    private readonly stroke: PaintStroke,
    private readonly track: (rect: Rect | null) => void,
    private readonly captureDelta: (rect: Rect | null) => PaintDelta | null,
  ) {}

  add(points: readonly number[]) {
    const limit = MAX_STROKE_POINTS * 2
    let offset = 0

    while (offset < points.length) {
      const room = limit - this.stroke.points.length

      if (room <= 0) {
        this.completed.push(this.toOp())
        this.stroke.restart()
        continue
      }
      const piece = points.slice(offset, offset + room)

      this.stroke.add(piece)
      offset += piece.length
    }
  }

  /**
   * Commits the stroke. The delta is what the stroke covered before it was drawn, so it can be
   * taken back without replaying; null for a split stroke (its base was saved again midway).
   */
  finish(): { ops: StrokeOp[], delta: PaintDelta | null } {
    this.track(this.stroke.dirty)
    const delta = this.isSplit ? null : this.captureDelta(this.stroke.dirty)

    return { ops: [...this.completed, this.toOp()], delta }
  }

  /** Whether parts of the stroke were already split off into ops; such a stroke cannot be taken back. */
  get isSplit(): boolean {
    return this.completed.length > 0
  }

  /** Takes the stroke back, e.g. when a second finger starts a zoom gesture. Only valid before a split. */
  cancel() {
    this.stroke.cancel()
  }

  private toOp(): StrokeOp {
    const { tool, color, width, opacity } = this.stroke.style
    const op: StrokeOp = { type: 'stroke', region: this.region, tool, color, width, points: [...this.stroke.points] }

    if (opacity !== undefined) op.opacity = opacity

    return op
  }
}
