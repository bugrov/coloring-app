import type { Op, Tool } from '../../shared'
import { BrushCache } from './brushes'
import { context2d, createCanvas, intersectRect, unionRect, type AnyCanvas, type AnyContext, type Rect } from './canvas'
import { BRUSH_STAMP_SPACING } from './constants'
import type { ArtGeometry, RegionShape } from './geometry'
import { RegionMask } from './mask'
import type { ArtSpace } from './space'
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
    readonly space: ArtSpace,
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
    const region = this.geometry.region(regionId)
    if (!region) return null
    const rect = this.mask.use(region)
    if (restorable) {
      this.backupContext.clearRect(rect.x, rect.y, rect.width, rect.height)
      this.backupContext.drawImage(this.canvas, rect.x, rect.y, rect.width, rect.height, rect.x, rect.y, rect.width, rect.height)
    }
    return new PaintStroke(this, region, rect, style)
  }

  fill(regionId: number, color: string): Rect | null {
    const region = this.geometry.region(regionId)
    if (!region) return null
    const rect = this.mask.use(region)
    const ctx = this.scratchContext
    ctx.clearRect(rect.x, rect.y, rect.width, rect.height)
    ctx.fillStyle = color
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
    this.composite(rect, 'source-over')
    return rect
  }

  clear(regionId: number): Rect | null {
    const region = this.geometry.region(regionId)
    if (!region) return null
    const rect = this.mask.use(region)
    this.ctx.globalCompositeOperation = 'destination-out'
    this.ctx.drawImage(this.mask.canvas, rect.x, rect.y, rect.width, rect.height, rect.x, rect.y, rect.width, rect.height)
    this.ctx.globalCompositeOperation = 'source-over'
    return rect
  }

  apply(op: Op): Rect | null {
    switch (op.type) {
      case 'stroke': {
        const stroke = this.beginStroke(op.region, op)
        return stroke ? stroke.add(op.points) : null
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

  /** @internal Draws one chunk of a stroke; used by {@link PaintStroke}. */
  drawSegment(regionRect: Rect, style: StrokeStyle, from: [number, number] | null, points: number[], walker: StampWalker): Rect | null {
    const widthPx = this.space.gridToPaint(style.width)
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
      const start = from ?? [points[0]!, points[1]!]
      ctx.moveTo(start[0], start[1])
      // A zero-length line with round caps draws a dot for a single tap.
      ctx.lineTo(start[0], start[1])
      for (let i = from ? 0 : 2; i + 1 < points.length; i += 2) ctx.lineTo(points[i]!, points[i + 1]!)
      ctx.stroke()
    }
    ctx.restore()

    this.composite(rect, style.tool === 'eraser' ? 'destination-out' : 'source-over')
    return rect
  }

  /** @internal Puts saved pixels back after a cancelled stroke. */
  restore(rect: Rect) {
    this.ctx.clearRect(rect.x, rect.y, rect.width, rect.height)
    this.ctx.drawImage(this.backup, rect.x, rect.y, rect.width, rect.height, rect.x, rect.y, rect.width, rect.height)
  }

  /** Masks the scratch rectangle and blends it onto the paint. */
  private composite(rect: Rect, operation: GlobalCompositeOperation) {
    const scratch = this.scratchContext
    scratch.globalCompositeOperation = 'destination-in'
    scratch.drawImage(this.mask.canvas, rect.x, rect.y, rect.width, rect.height, rect.x, rect.y, rect.width, rect.height)
    scratch.globalCompositeOperation = 'source-over'

    this.ctx.globalCompositeOperation = operation
    this.ctx.drawImage(this.scratch, rect.x, rect.y, rect.width, rect.height, rect.x, rect.y, rect.width, rect.height)
    this.ctx.globalCompositeOperation = 'source-over'
  }
}

/** A stroke in progress. Points are in grid units, as stored in ops. */
export class PaintStroke {
  /** Every point added so far, grid units. */
  readonly points: number[] = []
  /** Paint area touched so far. */
  dirty: Rect | null = null
  private last: [number, number] | null = null
  private readonly walker: StampWalker

  constructor(
    private readonly painter: Painter,
    readonly region: RegionShape,
    private readonly regionRect: Rect,
    readonly style: StrokeStyle,
  ) {
    this.walker = new StampWalker(painter.space.gridToPaint(style.width) * BRUSH_STAMP_SPACING)
  }

  add(gridPoints: readonly number[]): Rect | null {
    if (gridPoints.length < 2) return null
    this.points.push(...gridPoints)
    const paintPoints = gridPoints.map(value => this.painter.space.gridToPaint(value))
    const rect = this.painter.drawSegment(this.regionRect, this.style, this.last, paintPoints, this.walker)
    this.last = [paintPoints[paintPoints.length - 2]!, paintPoints[paintPoints.length - 1]!]
    this.dirty = unionRect(this.dirty, rect)
    return rect
  }

  /** Takes the stroke back; requires the stroke to have been started as restorable. */
  cancel() {
    this.painter.restore(this.regionRect)
  }
}
