import { MAX_STROKE_POINTS } from '../../shared'
import type { ClearOp, ColoringArt, FillOp, Op, StrokeOp, Tool } from '../../shared'
import { TOOL_WIDTH } from './constants'
import { exportPng } from './export'
import { ArtGeometry } from './geometry'
import { Painter, type PaintStroke } from './painter'
import { ProgressTracker, type Progress } from './progress'
import { ArtSpace } from './space'

export { HOLD_DURATION_MS, HOLD_TOLERANCE_PX, WHEEL_ZOOM_SPEED } from './constants'
export { HoldDetector } from './hold'
export type { Progress } from './progress'
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
  readonly geometry: ArtGeometry
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
    const style = { tool, color: tool === 'eraser' ? null : color, width: this.space.gridWidthFor(TOOL_WIDTH[tool]) }
    const stroke = this.painter.beginStroke(region, style, true)
    return stroke ? new StrokeRecorder(stroke, this.tracker, this.painter.canvas) : null
  }

  fill(region: number, color: string): FillOp {
    const op: FillOp = { type: 'fill', region, color }
    this.applyAndTrack(op)
    return op
  }

  clear(region: number): ClearOp {
    const op: ClearOp = { type: 'clear', region }
    this.applyAndTrack(op)
    return op
  }

  /** Rebuilds the paint from scratch; the basis for undo/redo and restoring a session. */
  replay(ops: readonly Op[]) {
    this.painter.clearAll()
    for (const op of ops) this.painter.apply(op)
    this.tracker.update(this.painter.canvas, this.painter.fullRect)
  }

  get progress(): Progress {
    return this.tracker.progress
  }

  exportPng(): Promise<Blob> {
    return exportPng(this.space, this.geometry, this.painter.canvas)
  }

  private applyAndTrack(op: Op) {
    const rect = this.painter.apply(op)
    if (rect) this.tracker.update(this.painter.canvas, rect)
  }
}

/** Records a live stroke and turns it into ops when the pointer is released. */
export class StrokeRecorder {
  constructor(
    private readonly stroke: PaintStroke,
    private readonly tracker: ProgressTracker,
    private readonly canvas: HTMLCanvasElement,
  ) {}

  get region(): number {
    return this.stroke.region.id
  }

  add(points: readonly number[]) {
    this.stroke.add(points)
  }

  /** Commits the stroke. Very long strokes become several ops of bounded size. */
  finish(): StrokeOp[] {
    const { points, style, dirty } = this.stroke
    if (dirty) this.tracker.update(this.canvas, dirty)

    const ops: StrokeOp[] = []
    const chunk = MAX_STROKE_POINTS * 2
    // Consecutive chunks share a point so the line stays continuous.
    for (let start = 0; start < points.length; start += chunk - 2) {
      ops.push({
        type: 'stroke',
        region: this.region,
        tool: style.tool,
        color: style.color,
        width: style.width,
        points: points.slice(start, start + chunk),
      })
      if (start + chunk >= points.length) break
    }
    return ops
  }

  /** Takes the stroke back, e.g. when a second finger starts a zoom gesture. */
  cancel() {
    this.stroke.cancel()
  }
}
