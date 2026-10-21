import { DEFAULT_OPACITY } from '../../shared'
import type { Op, Tool } from '../../shared'
import { BrushCache } from './brushes'
import { context2d, copyRect, createCanvas, intersectRect, releaseCanvas, unionRect, type AnyCanvas, type AnyContext, type Rect } from './canvas'
import { BRUSH_STAMP_SPACING } from './constants'
import type { ArtGeometry } from './geometry'
import { RegionMasks, type PreparedMask } from './mask'
import { gridToPaint, type ArtSpace } from './space'
import { StampWalker } from './stamps'

export interface StrokeStyle {
  tool: Tool
  /** Null for the eraser. */
  color: string | null
  /** Line width in grid units. */
  width: number
  /** Percent, fully opaque when absent; the eraser always removes paint completely. */
  opacity?: number
}

const toAlpha = (percent: number) => percent / 100

/** The share of the paint a mark keeps when composited. */
function alphaOf(style: StrokeStyle): number {
  return style.tool === 'eraser' ? 1 : toAlpha(style.opacity ?? DEFAULT_OPACITY)
}

/**
 * A soft brush stamped at partial opacity builds the whole stroke on the
 * scratch canvas, so overlapping stamps never add up on the paint itself.
 */
function accumulatesOnScratch(style: StrokeStyle): boolean {
  return style.tool === 'brush' && alphaOf(style) < 1
}

/** Extra pixels around a segment's bounds so caps and soft edges are not cut. */
const SEGMENT_PADDING = 2

/** What a stroke needs from the painter; keeps the painter's canvases private. */
interface StrokeTarget {
  /**
   * Draws the new points (paint pixels). `path` is every point of the current
   * op so far: live line tools redraw it within the touched area, so live
   * drawing gives exactly the pixels a replay of the op gives.
   */
  draw: (from: [number, number] | null, points: number[], path: readonly number[], walker: StampWalker) => Rect | null
  /** Makes the current paint the base the stroke is drawn over (after a split). */
  rebase: () => void
  restore: () => void
}

/**
 * Draws ops onto the paint canvas. Every mark is first drawn onto a scratch
 * canvas, multiplied by the region mask and only then composited onto the
 * paint, so nothing ever lands outside the region.
 */
export class Painter {
  private readonly ctx: AnyContext
  private readonly scratch: AnyCanvas
  private readonly scratchContext: AnyContext
  private readonly backup: AnyCanvas
  /** Only for brush strokes at partial opacity; created on first use. */
  private masked: AnyCanvas | null = null
  private maskedContext: AnyContext | null = null
  private readonly backupContext: AnyContext
  private readonly masks: RegionMasks
  private readonly brushes = new BrushCache()

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly space: ArtSpace,
    private readonly geometry: ArtGeometry,
  ) {
    canvas.width = space.paintWidth
    canvas.height = space.paintHeight
    this.ctx = context2d(canvas)
    this.scratch = createCanvas(space.paintWidth, space.paintHeight)
    this.scratchContext = context2d(this.scratch)
    this.backup = createCanvas(space.paintWidth, space.paintHeight)
    this.backupContext = context2d(this.backup)
    this.masks = new RegionMasks(space, geometry)
  }

  get fullRect(): Rect {
    return { x: 0, y: 0, width: this.space.paintWidth, height: this.space.paintHeight }
  }

  /**
   * Starts a stroke. A `live` stroke (drawn by the user, not replayed) saves
   * the region's pixels first, which serves two purposes: the stroke can be
   * taken back (a second finger turned it into a gesture), and line tools
   * redraw their path over that base every frame so caps never accumulate.
   */
  beginStroke(regionId: number, style: StrokeStyle, live = false): PaintStroke | null {
    const mask = this.prepare(regionId)
    if (!mask) return null
    const { rect } = mask
    // A stroke that builds up on the scratch canvas starts from an empty one.
    const resetScratch = () => {
      if (accumulatesOnScratch(style)) this.scratchContext.clearRect(rect.x, rect.y, rect.width, rect.height)
    }
    if (live) this.saveBackup(rect)
    resetScratch()
    return new PaintStroke(style, {
      draw: (from, points, path, walker) => this.drawSegment(regionId, style, from, points, live ? path : null, walker),
      rebase: () => {
        if (live) this.saveBackup(rect)
        resetScratch()
      },
      restore: () => this.restoreBackup(rect),
    })
  }

  fill(regionId: number, color: string, opacity = DEFAULT_OPACITY): Rect | null {
    const mask = this.prepare(regionId)
    if (!mask) return null
    const { rect } = mask
    const ctx = this.scratchContext
    ctx.clearRect(rect.x, rect.y, rect.width, rect.height)
    ctx.fillStyle = color
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
    this.composite(mask, rect, 'source-over', toAlpha(opacity))
    return rect
  }

  clear(regionId: number): Rect | null {
    const mask = this.prepare(regionId)
    if (!mask) return null
    this.ctx.globalCompositeOperation = 'destination-out'
    copyRect(this.ctx, mask.canvas, mask.rect)
    this.ctx.globalCompositeOperation = 'source-over'
    return mask.rect
  }

  apply(op: Op): Rect | null {
    switch (op.type) {
      case 'stroke': {
        const stroke = this.beginStroke(op.region, op)
        stroke?.add(op.points)
        return stroke?.dirty ?? null
      }
      case 'fill':
        return this.fill(op.region, op.color, op.opacity)
      case 'clear':
        return this.clear(op.region)
    }
  }

  clearAll() {
    this.ctx.clearRect(0, 0, this.space.paintWidth, this.space.paintHeight)
  }

  /** Copies the whole paint onto `target`, a canvas of the same size. */
  copyPaintTo(target: AnyCanvas) {
    const ctx = context2d(target)
    ctx.globalCompositeOperation = 'copy'
    ctx.drawImage(this.canvas, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
  }

  /** Replaces the whole paint with `source`, a canvas of the same size (a copy made by `copyPaintTo`). */
  restorePaintFrom(source: AnyCanvas) {
    this.ctx.globalCompositeOperation = 'copy'
    this.ctx.drawImage(source, 0, 0)
    this.ctx.globalCompositeOperation = 'source-over'
  }

  /** A blank canvas of the paint's size, for a snapshot. */
  createSnapshotCanvas(): AnyCanvas {
    return createCanvas(this.space.paintWidth, this.space.paintHeight)
  }

  dispose() {
    releaseCanvas(this.scratch)
    releaseCanvas(this.backup)
    if (this.masked) releaseCanvas(this.masked)
    this.masks.dispose()
  }

  /** The region's mask (built or cached), or null for an unknown region. */
  private prepare(regionId: number): PreparedMask | null {
    const region = this.geometry.region(regionId)
    return region ? this.masks.use(region) : null
  }

  private saveBackup(rect: Rect) {
    this.backupContext.clearRect(rect.x, rect.y, rect.width, rect.height)
    copyRect(this.backupContext, this.canvas, rect)
  }

  private restoreBackup(rect: Rect) {
    this.ctx.clearRect(rect.x, rect.y, rect.width, rect.height)
    copyRect(this.ctx, this.backup, rect)
  }

  /**
   * Draws one chunk of a stroke (paint pixels) and composites it inside the
   * region. With `path` (live line tools), the area is first reset to the
   * saved base and the path is drawn again, so caps between frames never
   * accumulate. The mask is looked up every time: other ops may have used
   * the mask cache since the stroke began.
   */
  private drawSegment(regionId: number, style: StrokeStyle, from: [number, number] | null, points: number[], path: readonly number[] | null, walker: StampWalker): Rect | null {
    const mask = this.prepare(regionId)
    if (!mask) return null
    const widthPx = gridToPaint(style.width)
    const reach = widthPx / 2 + SEGMENT_PADDING
    const rect = intersectRect(segmentBounds(from, points, reach), mask.rect)
    if (!rect) return null

    const ctx = this.scratchContext
    ctx.save()
    ctx.beginPath()
    ctx.rect(rect.x, rect.y, rect.width, rect.height)
    ctx.clip()
    const accumulate = accumulatesOnScratch(style)
    if (!accumulate) ctx.clearRect(rect.x, rect.y, rect.width, rect.height)
    if (style.tool === 'brush') {
      this.stampBrush(style.color ?? '#000000', widthPx, walker.walk(points))
    }
    else {
      this.traceLine(style, widthPx, path ?? (from ? [...from, ...points] : points), rect, reach)
    }
    ctx.restore()

    // Redrawn over the saved base each frame: line tools always, an accumulating brush because the
    // scratch already holds the whole stroke so far.
    if (path && (style.tool !== 'brush' || accumulate)) this.restoreBackup(rect)
    this.composite(mask, rect, style.tool === 'eraser' ? 'destination-out' : 'source-over', alphaOf(style), accumulate)
    return rect
  }

  private stampBrush(color: string, diameter: number, stamps: number[]) {
    const stamp = this.brushes.brushStamp(color, diameter)
    const radius = stamp.width / 2
    for (let i = 0; i + 1 < stamps.length; i += 2) {
      this.scratchContext.drawImage(stamp, stamps[i]! - radius, stamps[i + 1]! - radius)
    }
  }

  private traceLine(style: StrokeStyle, widthPx: number, line: readonly number[], rect: Rect, reach: number) {
    const ctx = this.scratchContext
    ctx.lineWidth = widthPx
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = style.tool === 'pencil' && style.color ? this.brushes.pencilPattern(ctx, style.color) : '#000'
    ctx.beginPath()
    tracePolylineNear(ctx, line, rect, reach)
    ctx.stroke()
  }

  /**
   * Masks the scratch rectangle and blends it onto the paint. A stroke that keeps building on
   * the scratch (`keepScratch`) is masked on a copy: masking the scratch itself would multiply
   * the soft edge of the mask in once per frame, so live drawing and replay would differ there.
   */
  private composite(mask: PreparedMask, rect: Rect, operation: GlobalCompositeOperation, alpha = 1, keepScratch = false) {
    let layer = this.scratch
    let layerContext = this.scratchContext
    if (keepScratch) {
      this.masked ??= createCanvas(this.space.paintWidth, this.space.paintHeight)
      layer = this.masked
      layerContext = this.maskedContext ??= context2d(this.masked)
      layerContext.clearRect(rect.x, rect.y, rect.width, rect.height)
      copyRect(layerContext, this.scratch, rect)
    }
    // destination-in affects the whole canvas, not just the drawn rect; the
    // clip keeps the work (and the clearing) inside the rect.
    layerContext.save()
    layerContext.beginPath()
    layerContext.rect(rect.x, rect.y, rect.width, rect.height)
    layerContext.clip()
    layerContext.globalCompositeOperation = 'destination-in'
    copyRect(layerContext, mask.canvas, rect)
    layerContext.restore()

    this.ctx.globalCompositeOperation = operation
    this.ctx.globalAlpha = alpha
    copyRect(this.ctx, layer, rect)
    this.ctx.globalAlpha = 1
    this.ctx.globalCompositeOperation = 'source-over'
  }
}

/** Bounds of a stroke chunk (from the previous point through the new ones), padded by `reach`. */
function segmentBounds(from: [number, number] | null, points: number[], reach: number): Rect {
  let minX = from ? from[0] : Infinity
  let minY = from ? from[1] : Infinity
  let maxX = from ? from[0] : -Infinity
  let maxY = from ? from[1] : -Infinity
  for (let i = 0; i + 1 < points.length; i += 2) {
    minX = Math.min(minX, points[i]!)
    maxX = Math.max(maxX, points[i]!)
    minY = Math.min(minY, points[i + 1]!)
    maxY = Math.max(maxY, points[i + 1]!)
  }
  return { x: minX - reach, y: minY - reach, width: maxX - minX + reach * 2, height: maxY - minY + reach * 2 }
}

/**
 * Adds the parts of a polyline that can touch `rect` to the current path.
 * Live strokes redraw their whole path every frame; skipping far segments
 * keeps that cost independent of the stroke length. Runs only break where
 * the line is farther than `reach` from the rectangle, so their caps fall
 * outside the clip and the pixels match drawing the full polyline.
 */
export function tracePolylineNear(ctx: AnyContext, line: readonly number[], rect: Rect, reach: number) {
  // A zero-length line with round caps draws a dot for a single tap.
  if (line.length < 4) {
    ctx.moveTo(line[0]!, line[1]!)
    ctx.lineTo(line[0]!, line[1]!)
    return
  }
  const left = rect.x - reach
  const top = rect.y - reach
  const right = rect.x + rect.width + reach
  const bottom = rect.y + rect.height + reach
  let inRun = false
  for (let i = 0; i + 3 < line.length; i += 2) {
    const x0 = line[i]!
    const y0 = line[i + 1]!
    const x1 = line[i + 2]!
    const y1 = line[i + 3]!
    if (Math.max(x0, x1) < left || Math.min(x0, x1) > right || Math.max(y0, y1) < top || Math.min(y0, y1) > bottom) {
      inRun = false
      continue
    }
    if (!inRun) {
      ctx.moveTo(x0, y0)
      ctx.lineTo(x0, y0)
      inRun = true
    }
    ctx.lineTo(x1, y1)
  }
}

/** A stroke in progress. Points are in grid units, as stored in ops. */
export class PaintStroke {
  private readonly gridPoints: number[] = []
  private readonly paintPath: number[] = []
  private dirtyRect: Rect | null = null
  private last: [number, number] | null = null
  private walker: StampWalker

  constructor(readonly style: StrokeStyle, private readonly target: StrokeTarget) {
    this.walker = this.createWalker()
  }

  /** Every point since the stroke (or its last restart) began, grid units. */
  get points(): readonly number[] {
    return this.gridPoints
  }

  /** Paint area touched so far, across restarts. */
  get dirty(): Rect | null {
    return this.dirtyRect
  }

  add(gridPoints: readonly number[]) {
    if (gridPoints.length < 2) return
    this.gridPoints.push(...gridPoints)
    const paintPoints = gridPoints.map(gridToPaint)
    this.paintPath.push(...paintPoints)
    const rect = this.target.draw(this.last, paintPoints, this.paintPath, this.walker)
    this.last = [paintPoints[paintPoints.length - 2]!, paintPoints[paintPoints.length - 1]!]
    this.dirtyRect = unionRect(this.dirtyRect, rect)
  }

  /**
   * Continues the line as a fresh stroke starting at the last point, exactly as
   * replaying a separate op would draw it. Used to split very long strokes.
   */
  restart() {
    const x = this.gridPoints[this.gridPoints.length - 2]!
    const y = this.gridPoints[this.gridPoints.length - 1]!
    this.gridPoints.length = 0
    this.paintPath.length = 0
    this.last = null
    this.walker = this.createWalker()
    this.target.rebase()
    this.add([x, y])
  }

  /** Takes the stroke back; requires a live stroke. */
  cancel() {
    this.target.restore()
  }

  private createWalker(): StampWalker {
    return new StampWalker(gridToPaint(this.style.width) * BRUSH_STAMP_SPACING)
  }
}
