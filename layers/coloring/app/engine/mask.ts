import { context2d, createCanvas, releaseCanvas, type AnyCanvas, type AnyContext, type Rect } from './canvas'
import type { ArtGeometry, RegionShape } from './geometry'
import type { ArtSpace } from './space'

/**
 * Opaque exactly where a region is visible: its own shape minus the regions
 * stacked above it. Strokes and fills are multiplied by this mask, which is
 * what keeps paint inside the region a stroke started in.
 *
 * One full-size canvas is reused; the last region's mask is kept because
 * consecutive strokes usually stay in the same region.
 */
export class RegionMask {
  readonly canvas: AnyCanvas
  private readonly ctx: AnyContext
  private regionId = 0
  private rect: Rect | null = null

  constructor(private readonly space: ArtSpace, private readonly geometry: ArtGeometry) {
    this.canvas = createCanvas(space.paintWidth, space.paintHeight)
    this.ctx = context2d(this.canvas)
  }

  /** Prepares the mask for a region and returns its paint rectangle. */
  use(region: RegionShape): Rect {
    const rect = this.geometry.paintRect(region)
    if (this.regionId === region.id) return rect

    const { ctx } = this
    if (this.rect) ctx.clearRect(this.rect.x, this.rect.y, this.rect.width, this.rect.height)

    ctx.save()
    ctx.setTransform(...this.space.artToPaintTransform)
    ctx.fillStyle = '#000'
    ctx.fill(region.path, region.fillRule)
    ctx.globalCompositeOperation = 'destination-out'
    for (const other of this.geometry.regionsAbove(region.id)) {
      ctx.fill(other.path, other.fillRule)
    }
    ctx.restore()

    this.regionId = region.id
    this.rect = rect
    return rect
  }

  dispose() {
    releaseCanvas(this.canvas)
  }
}
