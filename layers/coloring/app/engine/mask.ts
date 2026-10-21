import { context2d, createCanvas, releaseCanvas, type AnyCanvas, type AnyContext, type Rect } from './canvas'
import type { ArtGeometry, RegionShape } from './geometry'
import type { ArtSpace } from './space'

export interface PreparedMask {
  /** Opaque exactly where the region is visible. */
  canvas: AnyCanvas
  /** The region's paint rectangle; the mask is valid within it. */
  rect: Rect
}

interface Slot {
  canvas: AnyCanvas
  ctx: AnyContext
  regionId: number
  rect: Rect | null
  lastUsed: number
}

/**
 * Masks of regions: each is opaque exactly where its region is visible, i.e.
 * its own shape minus the regions stacked above it. Strokes and fills are
 * multiplied by the mask, which keeps paint inside the region.
 *
 * Two full-size slots, least recently used is rebuilt: children usually go
 * back and forth between an object and the background, and the background
 * mask (every region cut out of it) is the most expensive one to rebuild.
 */
export class RegionMasks {
  private readonly slots: Slot[]
  private clock = 0

  constructor(private readonly space: ArtSpace, private readonly geometry: ArtGeometry) {
    this.slots = Array.from({ length: 2 }, () => {
      const canvas = createCanvas(space.paintWidth, space.paintHeight)
      return { canvas, ctx: context2d(canvas), regionId: 0, rect: null, lastUsed: 0 }
    })
  }

  use(region: RegionShape): PreparedMask {
    const cached = this.slots.find(slot => slot.regionId === region.id)
    const slot = cached ?? this.slots.reduce((oldest, next) => (next.lastUsed < oldest.lastUsed ? next : oldest))
    slot.lastUsed = ++this.clock
    if (!cached) this.build(slot, region)
    return { canvas: slot.canvas, rect: slot.rect! }
  }

  dispose() {
    for (const slot of this.slots) releaseCanvas(slot.canvas)
  }

  private build(slot: Slot, region: RegionShape) {
    const { ctx } = slot
    if (slot.rect) ctx.clearRect(slot.rect.x, slot.rect.y, slot.rect.width, slot.rect.height)

    ctx.save()
    ctx.setTransform(...this.space.artToPaintTransform)
    ctx.fillStyle = '#000'
    ctx.fill(region.path, region.fillRule)
    ctx.globalCompositeOperation = 'destination-out'
    for (const other of this.geometry.regionsAbove(region.id)) {
      ctx.fill(other.path, other.fillRule)
    }
    ctx.restore()

    slot.regionId = region.id
    slot.rect = this.geometry.paintRect(region)
  }
}
