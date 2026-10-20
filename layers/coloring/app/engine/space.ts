import { OP_GRID } from '../../shared'
import type { ColoringArt } from '../../shared'
import { PAINT_LONG_SIDE } from './constants'

/**
 * Coordinate systems of one art:
 * - art units: the SVG viewBox the paths are defined in;
 * - grid units: integers stored in ops (OP_GRID spans the long side);
 * - paint pixels: the paint canvas (PAINT_LONG_SIDE spans the long side).
 */
export class ArtSpace {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly longSide: number
  /** Paint canvas size in pixels. */
  readonly paintWidth: number
  readonly paintHeight: number
  /** Paint pixels per art unit. */
  readonly paintScale: number

  constructor(art: Pick<ColoringArt, 'viewBox'>) {
    ;[this.x, this.y, this.width, this.height] = art.viewBox
    this.longSide = Math.max(this.width, this.height)
    this.paintScale = PAINT_LONG_SIDE / this.longSide
    this.paintWidth = Math.round(this.width * this.paintScale)
    this.paintHeight = Math.round(this.height * this.paintScale)
  }

  /** Size of the grid in grid units along each axis. */
  get gridWidth(): number {
    return (this.width / this.longSide) * OP_GRID
  }

  get gridHeight(): number {
    return (this.height / this.longSide) * OP_GRID
  }

  /** Grid units per paint pixel. */
  get gridPerPaint(): number {
    return OP_GRID / PAINT_LONG_SIDE
  }

  /** Grid point from a position given as a share (0–1) of the rendered art. */
  gridFromRatio(rx: number, ry: number): [number, number] {
    const clamp = (value: number, max: number) => Math.min(max, Math.max(0, Math.round(value)))
    return [clamp(rx * this.gridWidth, Math.floor(this.gridWidth)), clamp(ry * this.gridHeight, Math.floor(this.gridHeight))]
  }

  gridToArt(gx: number, gy: number): [number, number] {
    const unit = this.longSide / OP_GRID
    return [this.x + gx * unit, this.y + gy * unit]
  }

  gridToPaint(value: number): number {
    return value / this.gridPerPaint
  }

  /** Line width in grid units for a width given as a share of the long side. */
  gridWidthFor(share: number): number {
    return Math.max(1, Math.round(share * OP_GRID))
  }

  /** Canvas transform that maps art units onto paint pixels. */
  get artToPaintTransform(): [number, number, number, number, number, number] {
    const s = this.paintScale
    return [s, 0, 0, s, -this.x * s, -this.y * s]
  }
}
