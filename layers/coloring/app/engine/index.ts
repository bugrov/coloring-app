import { MAX_STROKE_POINTS } from '../../shared'
import type { ClearOp, ColoringArt, FillOp, Op, StrokeOp, Tool } from '../../shared'
import type { Rect } from './canvas'
import { TOOL_WIDTH } from './constants'
import { exportPng } from './export'
import { ArtGeometry } from './geometry'
import { Painter, type PaintStroke } from './painter'
import { ProgressTracker, type Progress } from './progress'
import { ArtSpace, gridLength } from './space'

export {
  HOLD_DURATION_MS,
  HOLD_TOLERANCE_PX,
  HOLD_VIBRATION_MS,
  PINCH_MIN_DISTANCE_PX,
  WHEEL_LINE_HEIGHT_PX,
  WHEEL_PAN_MAX_DELTA_PX,
  WHEEL_ZOOM_MAX_DELTA_PX,
  WHEEL_ZOOM_SPEED,
} from './constants'
export { HoldDetector } from './hold'
export { EMPTY_PROGRESS, type Progress } from './progress'
export { clampView, IDENTITY_VIEW, panBy, zoomAt, type View } from './viewport'

/**
 * The colouring engine for one art: hit testing, drawing, progress and
 * export. It knows nothing about the DOM beyond the paint canvas and turns
 * every user action into an {@link Op}; replaying the ops rebuilds the image.
 *
 * Deliberately not reactive: it lives outside Vue's reactivity (markRaw) so
 * the drawing hot path never triggers watchers.
 */
export class ColoringEngine {
  readonly space: ArtSpace
  private readonly geometry: ArtGeometry
  private readonly painter: Painter
  private readonly tracker: ProgressTracker

  constructor(art: ColoringArt, canvas: HTMLCanvasElement) {
    this.space = new ArtSpace(art)
    this.geometry = new ArtGeometry(art, this.space)
    this.painter = new Painter(canvas, this.space, this.geometry)
    this.tracker = new ProgressTracker(this.space, this.geometry)
  }

  /** Grid point and region under a position given as a share (0–1) of the rendered art. */
  locate(rx: number, ry: number): { point: [number, number], region: number | null } {
    const point = this.space.gridFromRatio(rx, ry)
    const [x, y] = this.space.gridToArt(...point)
    return { point, region: this.geometry.hitTest(x, y)?.id ?? null }
  }

  beginStroke(region: number, tool: Tool, color: string): StrokeRecorder | null {
    const style = { tool, color: tool === 'eraser' ? null : color, width: gridLength(TOOL_WIDTH[tool]) }
    const stroke = this.painter.beginStroke(region, style, true)
    return stroke ? new StrokeRecorder(region, stroke, rect => this.track(rect)) : null
  }

  fill(region: number, color: string): FillOp {
    const op: FillOp = { type: 'fill', region, color }
    this.track(this.painter.apply(op))
    return op
  }

  clear(region: number): ClearOp {
    const op: ClearOp = { type: 'clear', region }
    this.track(this.painter.apply(op))
    return op
  }

  /** Rebuilds the paint from scratch; the basis for undo/redo and restoring a session. */
  replay(ops: readonly Op[]) {
    this.painter.clearAll()
    for (const op of ops) this.painter.apply(op)
    this.track(this.painter.fullRect)
  }

  get progress(): Progress {
    return this.tracker.progress
  }

  exportPng(): Promise<Blob> {
    return exportPng(this.space, this.geometry, this.painter.canvas)
  }

  /** Releases the offscreen canvases right away; iOS limits total canvas memory. */
  dispose() {
    this.painter.dispose()
    this.tracker.dispose()
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

  /** Commits the stroke. */
  finish(): StrokeOp[] {
    this.track(this.stroke.dirty)
    return [...this.completed, this.toOp()]
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
    const { tool, color, width } = this.stroke.style
    return { type: 'stroke', region: this.region, tool, color, width, points: [...this.stroke.points] }
  }
}
