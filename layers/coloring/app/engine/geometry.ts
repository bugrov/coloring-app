import type { ArtInk, ArtRegion, Bounds, ColoringArt } from '../../shared'
import { context2d, createCanvas, type AnyContext, type Rect } from './canvas'
import type { ArtSpace } from './space'

export interface RegionShape extends Omit<ArtRegion, 'd' | 'fillRule' | 'bounds'> {
  path: Path2D
  fillRule: CanvasFillRule
  /** In art units. */
  bounds: Bounds
}

export interface InkShape extends Omit<ArtInk, 'd' | 'fillRule'> {
  path: Path2D
  fillRule: CanvasFillRule
}

export type Shape = RegionShape | InkShape

/** Edge pixels added around region rectangles to cover anti-aliasing. */
const RECT_PADDING = 2

/** Art items turned into Path2D objects, with region lookups and hit testing. */
export class ArtGeometry {
  readonly items: Shape[]
  readonly regions: RegionShape[]
  private readonly byId = new Map<number, RegionShape>()
  private readonly above = new Map<number, RegionShape[]>()
  private readonly hitContext: AnyContext

  constructor(art: ColoringArt, private readonly space: ArtSpace) {
    this.items = art.items.map((item): Shape => {
      switch (item.type) {
        case 'region': {
          const { d, bounds: [minX, minY, maxX, maxY], ...region } = item

          return { ...region, path: new Path2D(d), bounds: { minX, minY, maxX, maxY } }
        }
        case 'ink': {
          const { d, ...ink } = item

          return { ...ink, path: new Path2D(d) }
        }
      }
    })
    this.regions = this.items.filter((item): item is RegionShape => item.type === 'region')

    for (const region of this.regions) this.byId.set(region.id, region)

    // Regions drawn later cover earlier ones; painting must not reach under them.
    this.regions.forEach((region, index) => {
      this.above.set(region.id, this.regions.slice(index + 1).filter(other => overlaps(region.bounds, other.bounds)))
    })

    this.hitContext = context2d(createCanvas(1, 1))
  }

  region(id: number): RegionShape | undefined {
    return this.byId.get(id)
  }

  regionsAbove(id: number): readonly RegionShape[] {
    return this.above.get(id) ?? []
  }

  /** Topmost region under an art-space point; ink is transparent to hits. */
  hitTest(x: number, y: number): RegionShape | null {
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const region = this.regions[i]!
      const { bounds } = region

      if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY) continue
      if (this.hitContext.isPointInPath(region.path, x, y, region.fillRule)) return region
    }

    return null
  }

  /** Region bounds in paint pixels, padded and clipped to the canvas. */
  paintRect(region: RegionShape): Rect {
    const { space } = this
    const s = space.paintScale
    const x = Math.max(0, Math.floor((region.bounds.minX - space.x) * s) - RECT_PADDING)
    const y = Math.max(0, Math.floor((region.bounds.minY - space.y) * s) - RECT_PADDING)
    const right = Math.min(space.paintWidth, Math.ceil((region.bounds.maxX - space.x) * s) + RECT_PADDING)
    const bottom = Math.min(space.paintHeight, Math.ceil((region.bounds.maxY - space.y) * s) + RECT_PADDING)

    return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) }
  }
}

/**
 * Draws the art in z-order: each region filled with `regionFill(region)`,
 * line art in its own colours or entirely in `inkColor`. Shared by the export
 * (white regions, real ink) and the progress label map (region codes, ink as
 * "no region"), so both agree on what is visible.
 */
export function drawArt(ctx: AnyContext, geometry: ArtGeometry, regionFill: (region: RegionShape) => string, inkColor?: string) {
  for (const item of geometry.items) {
    if (item.type === 'region') {
      ctx.fillStyle = regionFill(item)
      ctx.fill(item.path, item.fillRule)
    } else {
      drawInk(ctx, item, inkColor)
    }
  }
}

/** Draws line art in its own colours, or entirely in `color`. */
export function drawInk(ctx: AnyContext, ink: InkShape, color?: string) {
  if (ink.fill) {
    ctx.fillStyle = color ?? ink.fill
    ctx.fill(ink.path, ink.fillRule)
  }
  if (ink.stroke && ink.strokeWidth > 0) {
    ctx.strokeStyle = color ?? ink.stroke
    ctx.lineWidth = ink.strokeWidth
    ctx.lineCap = ink.lineCap
    ctx.lineJoin = ink.lineJoin
    ctx.miterLimit = ink.miterLimit
    ctx.stroke(ink.path)
  }
}

function overlaps(a: Bounds, b: Bounds): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY
}
