import { context2d, createCanvas, releaseCanvas, type AnyCanvas, type Rect } from './canvas'
import { PAINT_LONG_SIDE, PAINTED_ALPHA_MIN, PROGRESS_GRID_LONG_SIDE, PROGRESS_SAMPLE_STEP, REGION_COMPLETE_RATIO } from './constants'
import { drawArt, type ArtGeometry } from './geometry'
import type { ArtSpace } from './space'

/** Paint pixels per progress cell side; both grids span the art's long side. */
const CELL_PAINT_PX = PAINT_LONG_SIDE / PROGRESS_GRID_LONG_SIDE

export interface Progress {
  /** 0–100, reaches 100 only when every region is complete. */
  percent: number
  complete: boolean
}

/** The tracker's counts at a moment, so progress need not be measured again after going back to it. */
export interface ProgressState {
  painted: Uint8Array
  counts: Uint32Array
}

export const EMPTY_PROGRESS: Readonly<Progress> = { percent: 0, complete: false }

/**
 * Share of coloured area. A region at or above `tolerance` (the administrator's setting, by default
 * REGION_COMPLETE_RATIO) counts as fully coloured, so small gaps along outlines do not block 100%.
 * `totals[i]` and `painted[i]` are cell counts of the i-th counted region.
 */
export function computeProgress(totals: ArrayLike<number>, painted: ArrayLike<number>, tolerance = REGION_COMPLETE_RATIO): Progress {
  let area = 0
  let covered = 0
  let complete = true
  for (let i = 0; i < totals.length; i++) {
    const total = totals[i]!
    if (total === 0) continue
    const ratio = painted[i]! / total
    const done = ratio >= tolerance
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
  private readonly labels: Int32Array
  private readonly painted: Uint8Array
  private readonly totals: Uint32Array
  private readonly paintedCounts: Uint32Array

  constructor(space: ArtSpace, geometry: ArtGeometry, private readonly tolerance = REGION_COMPLETE_RATIO) {
    const scale = PROGRESS_GRID_LONG_SIDE / space.longSide
    this.gridWidth = Math.max(1, Math.round(space.width * scale))
    this.gridHeight = Math.max(1, Math.round(space.height * scale))

    const counted = geometry.regions.filter(region => region.kind === 'area')
    const indexById = new Map(counted.map((region, index) => [region.id, index]))
    this.totals = new Uint32Array(counted.length)
    this.paintedCounts = new Uint32Array(counted.length)
    this.painted = new Uint8Array(this.gridWidth * this.gridHeight)

    this.labels = this.renderLabels(space, geometry, indexById, scale)
  }

  /** Renders the label grid once; its canvas is released right after reading it back. */
  private renderLabels(space: ArtSpace, geometry: ArtGeometry, indexById: Map<number, number>, scale: number): Int32Array {
    const canvas = createCanvas(this.gridWidth, this.gridHeight)
    const ctx = context2d(canvas, { willReadFrequently: true })
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
    releaseCanvas(canvas)
    const labels = new Int32Array(this.gridWidth * this.gridHeight)
    for (let cell = 0; cell < labels.length; cell++) {
      const code = (data[cell * 4]! << 16) | (data[cell * 4 + 1]! << 8) | data[cell * 4 + 2]!
      const index = codes.get(code) ?? NO_REGION
      labels[cell] = index
      if (index !== NO_REGION) this.totals[index]!++
    }
    return labels
  }

  /**
   * Re-reads the cells under a rectangle of the paint canvas (paint pixels).
   * A cell counts as painted when at least half of its block of paint pixels
   * is. Counted here rather than by downscaling with drawImage, whose
   * filtering differs between browsers: the same history must give the same
   * progress everywhere.
   */
  update(paint: AnyCanvas, rect: Rect) {
    const cell = CELL_PAINT_PX
    const left = Math.max(0, Math.floor(rect.x / cell))
    const top = Math.max(0, Math.floor(rect.y / cell))
    const right = Math.min(this.gridWidth, Math.ceil((rect.x + rect.width) / cell))
    const bottom = Math.min(this.gridHeight, Math.ceil((rect.y + rect.height) / cell))
    // Grid and paint sizes are rounded separately: the last cells may reach past the paint edge.
    const pixelRight = Math.min(paint.width, right * cell)
    const pixelBottom = Math.min(paint.height, bottom * cell)
    if (pixelRight <= left * cell || pixelBottom <= top * cell) return

    const width = pixelRight - left * cell
    const { data } = context2d(paint).getImageData(left * cell, top * cell, width, pixelBottom - top * cell)
    for (let row = top; row < bottom; row++) {
      for (let column = left; column < right; column++) {
        const index = this.labels[row * this.gridWidth + column]!
        if (index === NO_REGION) continue
        this.setPainted(row * this.gridWidth + column, index, this.isBlockPainted(data, width, (column - left) * cell, (row - top) * cell, pixelRight - column * cell, pixelBottom - row * cell))
      }
    }
  }

  private isBlockPainted(data: Uint8ClampedArray, stride: number, x0: number, y0: number, maxWidth: number, maxHeight: number): boolean {
    const blockWidth = Math.min(CELL_PAINT_PX, maxWidth)
    const blockHeight = Math.min(CELL_PAINT_PX, maxHeight)
    if (blockWidth <= 0 || blockHeight <= 0) return false
    // A fixed sub-grid of pixels: deterministic, and 4× cheaper than every pixel
    // (this runs over the whole canvas on replay).
    let painted = 0
    let samples = 0
    for (let y = y0; y < y0 + blockHeight; y += PROGRESS_SAMPLE_STEP) {
      for (let x = x0; x < x0 + blockWidth; x += PROGRESS_SAMPLE_STEP) {
        samples++
        if (data[(y * stride + x) * 4 + 3]! >= PAINTED_ALPHA_MIN) painted++
      }
    }
    return painted * 2 >= samples
  }

  private setPainted(cell: number, index: number, isPainted: boolean) {
    const value = isPainted ? 1 : 0
    if (value === this.painted[cell]) return
    this.painted[cell] = value
    this.paintedCounts[index]! += isPainted ? 1 : -1
  }

  /** Forgets everything painted (the paint canvas was cleared). */
  reset() {
    this.painted.fill(0)
    this.paintedCounts.fill(0)
  }

  /** Which cells count as painted; a copy that `restoreState` takes back. */
  saveState(): ProgressState {
    return { painted: this.painted.slice(), counts: this.paintedCounts.slice() }
  }

  restoreState(state: ProgressState) {
    this.painted.set(state.painted)
    this.paintedCounts.set(state.counts)
  }

  get progress(): Progress {
    return computeProgress(this.totals, this.paintedCounts, this.tolerance)
  }
}
