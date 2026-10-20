import type { Op, Tool } from '../../shared'
import { BrushCache } from './brushes'
import { context2d, copyRect, createCanvas, intersectRect, releaseCanvas, unionRect, type AnyCanvas, type AnyContext, type Rect } from './canvas'
import { BRUSH_STAMP_SPACING } from './constants'
import type { ArtGeometry } from './geometry'
import { RegionMask } from './mask'
import { gridToPaint, type ArtSpace } from './space'
import { StampWalker } from './stamps'

export interface StrokeStyle {
  tool: Tool
  /** Null for the eraser. */
  color: string | null
  /** Line width in grid units. */
  width: number
}

/** Extra pixels around a segment's bounds so caps and soft edges are not cut. */
const SEGMENT_PADDING = 2

/** What a stroke needs from the painter; keeps the painter's canvases private. */
interface StrokeTarget {
  /**
   * Draws the new points (paint pixels). `path` is every point of the current
   * op so far: line tools redraw it whole within the touched area, so live
   * drawing gives exactly the pixels a replay of the op gives.
   */
  draw: (style: StrokeStyle, from: [number, number] | null, points: number[], path: readonly number[], walker: StampWalker) => Rect | null
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
  readonly ctx: AnyContext
  private readonly scratch: AnyCanvas
  private readonly scratchContext: AnyContext
  private readonly backup: AnyCanvas
  private readonly backupContext: AnyContext
  private readonly mask: RegionMask
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
    this.mask = new RegionMask(space, geometry)
  }

  get fullRect(): Rect {
    return { x: 0, y: 0, width: this.space.paintWidth, height: this.space.paintHeight }
  }

  /**
   * Starts a stroke. With `restorable`, the region's pixels are saved first so
   * the stroke can be taken back (a second finger turned it into a gesture).
   */
  beginStroke(regionId: number, style: StrokeStyle, restorable = false): PaintStroke | null {
    const rect = this.prepare(regionId)
    if (!rect) return null
    const saveBase = () => {
      this.backupContext.clearRect(rect.x, rect.y, rect.width, rect.height)
      copyRect(this.backupContext, this.canvas, rect)
    }
    if (restorable) saveBase()
    return new PaintStroke(style, {
      // Live strokes redraw the whole path over the saved base; replays draw it once.
      draw: (strokeStyle, from, points, path, walker) => this.drawSegment(rect, strokeStyle, from, points, restorable ? path : null, walker),
      rebase: () => {
        if (restorable) saveBase()
      },
      restore: () => {
        this.ctx.clearRect(rect.x, rect.y, rect.width, rect.height)
        copyRect(this.ctx, this.backup, rect)
      },
    })
  }

  fill(regionId: number, color: string): Rect | null {
    const rect = this.prepare(regionId)
    if (!rect) return null
    const ctx = this.scratchContext
    ctx.clearRect(rect.x, rect.y, rect.width, rect.height)
    ctx.fillStyle = color
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
    this.composite(rect, 'source-over')
    return rect
  }

  clear(regionId: number): Rect | null {
    const rect = this.prepare(regionId)
    if (!rect) return null
    this.ctx.globalCompositeOperation = 'destination-out'
    copyRect(this.ctx, this.mask.canvas, rect)
    this.ctx.globalCompositeOperation = 'source-over'
    return rect
  }

  apply(op: Op): Rect | null {
    switch (op.type) {
      case 'stroke': {
        const stroke = this.beginStroke(op.region, op)
        stroke?.add(op.points)
        return stroke?.dirty ?? null
      }
      case 'fill':
        return this.fill(op.region, op.color)
      case 'clear':
        return this.clear(op.region)
    }
  }

  clearAll() {
    this.ctx.clearRect(0, 0, this.space.paintWidth, this.space.paintHeight)
  }

  dispose() {
    releaseCanvas(this.scratch)
    releaseCanvas(this.backup)
    this.mask.dispose()
  }

  /** Builds the region's mask; returns its paint rectangle, or null for an unknown region. */
  private prepare(regionId: number): Rect | null {
    const region = this.geometry.region(regionId)
    return region ? this.mask.use(region) : null
  }

  /**
   * Draws one chunk of a stroke (paint pixels) and composites it inside the
   * region. With `path` (live line tools), the area is first reset to the base
   * saved at stroke start and the whole path is drawn again, so overlapping
   * caps between frames never accumulate.
   */
  private drawSegment(regionRect: Rect, style: StrokeStyle, from: [number, number] | null, points: number[], path: readonly number[] | null, walker: StampWalker): Rect | null {
    const widthPx = gridToPaint(style.width)
    const reach = widthPx / 2 + SEGMENT_PADDING
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
    const rect = intersectRect({ x: minX - reach, y: minY - reach, width: maxX - minX + reach * 2, height: maxY - minY + reach * 2 }, regionRect)
    if (!rect) return null

    const ctx = this.scratchContext
    ctx.save()
    ctx.beginPath()
    ctx.rect(rect.x, rect.y, rect.width, rect.height)
    ctx.clip()
    ctx.clearRect(rect.x, rect.y, rect.width, rect.height)

    if (style.tool === 'brush') {
      const stamp = this.brushes.brushStamp(style.color ?? '#000000', widthPx)
      const radius = stamp.width / 2
      const stamps = walker.walk(points)
      for (let i = 0; i + 1 < stamps.length; i += 2) {
        ctx.drawImage(stamp, stamps[i]! - radius, stamps[i + 1]! - radius)
      }
    }
    else {
      ctx.lineWidth = widthPx
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = style.tool === 'pencil' && style.color ? this.brushes.pencilPattern(ctx, style.color) : '#000'
      ctx.beginPath()
      tracePolylineNear(ctx, path ?? (from ? [...from, ...points] : points), rect, reach)
      ctx.stroke()
    }
    ctx.restore()

    if (path && style.tool !== 'brush') {
      this.ctx.clearRect(rect.x, rect.y, rect.width, rect.height)
      copyRect(this.ctx, this.backup, rect)
    }
    this.composite(rect, style.tool === 'eraser' ? 'destination-out' : 'source-over')
    return rect
  }

  /** Masks the scratch rectangle and blends it onto the paint. */
  private composite(rect: Rect, operation: GlobalCompositeOperation) {
    const scratch = this.scratchContext
    scratch.globalCompositeOperation = 'destination-in'
    copyRect(scratch, this.mask.canvas, rect)
    scratch.globalCompositeOperation = 'source-over'

    this.ctx.globalCompositeOperation = operation
    copyRect(this.ctx, this.scratch, rect)
    this.ctx.globalCompositeOperation = 'source-over'
  }
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
    const rect = this.target.draw(this.style, this.last, paintPoints, this.paintPath, this.walker)
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

  /** Takes the stroke back; requires the stroke to have been started as restorable. */
  cancel() {
    this.target.restore()
  }

  private createWalker(): StampWalker {
    return new StampWalker(gridToPaint(this.style.width) * BRUSH_STAMP_SPACING)
  }
}
