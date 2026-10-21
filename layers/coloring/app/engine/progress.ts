import { context2d, createCanvas, releaseCanvas, type AnyCanvas, type AnyContext, type Rect } from './canvas'
import { PAINTED_ALPHA_MIN, PROGRESS_GRID_LONG_SIDE, REGION_COMPLETE_RATIO } from './constants'
import { drawArt, type ArtGeometry } from './geometry'
import type { ArtSpace } from './space'

export interface Progress {
  /** 0–100, reaches 100 only when every region is complete. */
  percent: number
  complete: boolean
}

export const EMPTY_PROGRESS: Readonly<Progress> = { percent: 0, complete: false }

/**
 * Share of coloured area. A region at or above REGION_COMPLETE_RATIO counts
 * as fully coloured, so small gaps along outlines do not block 100%.
 * `totals[i]` and `painted[i]` are cell counts of the i-th counted region.
 */
export function computeProgress(totals: ArrayLike<number>, painted: ArrayLike<number>): Progress {
  let area = 0
  let covered = 0
  let complete = true
  for (let i = 0; i < totals.length; i++) {
    const total = totals[i]!
    if (total === 0) continue
    const ratio = painted[i]! / total
    const done = ratio >= REGION_COMPLETE_RATIO
    complete &&= done
    area += total
    covered += done ? total : painted[i]!
  }
  if (area === 0) return { ...EMPTY_PROGRESS }
  return { percent: complete ? 100 : Math.min(99, Math.floor((covered / area) * 100)), complete }
}

/**
 * Spreads region indices over 24-bit colours so that anti-aliased edges
 * (blends of two codes) practically never decode to a third valid code.
 * Multiplying by an odd constant is a bijection modulo 2^24; 0 stays "none".
 */
export function regionCode(index: number): number {
  return (Math.imul(index + 1, 0x9E_37_79) >>> 0) & 0xFF_FF_FF
}

const NO_REGION = -1

/**
 * Tracks which cells of a coarse grid are painted, per region. The label grid
 * is rendered once from the art (regions in z-order, ink on top as "none"), so
 * only visible, colourable area counts. Updates read back just the dirty part
 * of the paint canvas, so the cost does not depend on history length.
 */
export class ProgressTracker {
  private readonly gridWidth: number
  private readonly gridHeight: number
  private readonly cellsPerPaintPx: number
  private readonly labels: Int32Array
  private readonly painted: Uint8Array
  private readonly totals: Uint32Array
  private readonly paintedCounts: Uint32Array
  private readonly sampler: AnyCanvas
  private readonly samplerContext: AnyContext

  constructor(space: ArtSpace, geometry: ArtGeometry) {
    const scale = PROGRESS_GRID_LONG_SIDE / space.longSide
    this.gridWidth = Math.max(1, Math.round(space.width * scale))
    this.gridHeight = Math.max(1, Math.round(space.height * scale))
    this.cellsPerPaintPx = this.gridWidth / space.paintWidth

    const counted = geometry.regions.filter(region => region.kind === 'area')
    const indexById = new Map(counted.map((region, index) => [region.id, index]))
    this.totals = new Uint32Array(counted.length)
    this.paintedCounts = new Uint32Array(counted.length)
    this.painted = new Uint8Array(this.gridWidth * this.gridHeight)

    this.sampler = createCanvas(this.gridWidth, this.gridHeight)
    this.samplerContext = context2d(this.sampler, { willReadFrequently: true })
    this.labels = this.renderLabels(space, geometry, indexById, scale)
  }

  private renderLabels(space: ArtSpace, geometry: ArtGeometry, indexById: Map<number, number>, scale: number): Int32Array {
    const ctx = this.samplerContext
    ctx.setTransform(...space.artTransform(scale))
    ctx.fillStyle = '#000'
    ctx.fillRect(space.x, space.y, space.width, space.height)

    const codes = new Map<number, number>()
    // Ink hides whatever is below it: drawn as code 0, those cells are not colourable.
    drawArt(ctx, geometry, (region) => {
      const index = indexById.get(region.id)
      if (index === undefined) return '#000'
      const code = regionCode(index)
      codes.set(code, index)
      return `#${code.toString(16).padStart(6, '0')}`
    }, '#000')
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    const { data } = ctx.getImageData(0, 0, this.gridWidth, this.gridHeight)
    const labels = new Int32Array(this.gridWidth * this.gridHeight)
    for (let cell = 0; cell < labels.length; cell++) {
      const code = (data[cell * 4]! << 16) | (data[cell * 4 + 1]! << 8) | data[cell * 4 + 2]!
      const index = codes.get(code) ?? NO_REGION
      labels[cell] = index
      if (index !== NO_REGION) this.totals[index]!++
    }
    return labels
  }

  /** Re-reads the cells under a rectangle of the paint canvas (paint pixels). */
  update(paint: AnyCanvas, { x, y, width, height }: Rect) {
    const k = this.cellsPerPaintPx
    const left = Math.max(0, Math.floor(x * k) - 1)
    const top = Math.max(0, Math.floor(y * k) - 1)
    const right = Math.min(this.gridWidth, Math.ceil((x + width) * k) + 1)
    const bottom = Math.min(this.gridHeight, Math.ceil((y + height) * k) + 1)
    if (right <= left || bottom <= top) return

    const ctx = this.samplerContext
    const cellsWide = right - left
    const cellsHigh = bottom - top
    // Grid and paint sizes are rounded independently, so the last cells may
    // reach past the paint edge; the source must stay inside the canvas.
    const sourceWidth = Math.min(cellsWide / k, paint.width - left / k)
    const sourceHeight = Math.min(cellsHigh / k, paint.height - top / k)
    ctx.clearRect(left, top, cellsWide, cellsHigh)
    ctx.drawImage(paint, left / k, top / k, sourceWidth, sourceHeight, left, top, sourceWidth * k, sourceHeight * k)
    const { data } = ctx.getImageData(left, top, cellsWide, cellsHigh)

    for (let row = 0; row < cellsHigh; row++) {
      for (let column = 0; column < cellsWide; column++) {
        const cell = (top + row) * this.gridWidth + left + column
        const index = this.labels[cell]!
        if (index === NO_REGION) continue
        const isPainted = data[(row * cellsWide + column) * 4 + 3]! >= PAINTED_ALPHA_MIN ? 1 : 0
        if (isPainted !== this.painted[cell]) {
          this.painted[cell] = isPainted
          this.paintedCounts[index]! += isPainted ? 1 : -1
        }
      }
    }
  }

  get progress(): Progress {
    return computeProgress(this.totals, this.paintedCounts)
  }

  dispose() {
    releaseCanvas(this.sampler)
  }
}
