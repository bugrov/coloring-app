import { OP_GRID } from '../../shared'
import type { ColoringArt } from '../../shared'
import { PAINT_LONG_SIDE } from './constants'

export type Transform = [number, number, number, number, number, number]

/** Paint pixels per grid unit; both span the art's long side. */
const PAINT_PER_GRID = PAINT_LONG_SIDE / OP_GRID

/** Line width in grid units for a width given as a share of the art's long side. */
export function gridLength(share: number): number {
  return Math.max(1, Math.round(share * OP_GRID))
}

export function gridToPaint(value: number): number {
  return value * PAINT_PER_GRID
}

function clampToGrid(value: number, size: number): number {
  return Math.min(Math.floor(size), Math.max(0, Math.round(value)))
}

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
  /** Grid size in grid units along each axis. */
  readonly gridWidth: number
  readonly gridHeight: number

  constructor(art: Pick<ColoringArt, 'viewBox'>) {
    ;[this.x, this.y, this.width, this.height] = art.viewBox
    this.longSide = Math.max(this.width, this.height)
    this.paintScale = PAINT_LONG_SIDE / this.longSide
    this.paintWidth = Math.round(this.width * this.paintScale)
    this.paintHeight = Math.round(this.height * this.paintScale)
    this.gridWidth = (this.width / this.longSide) * OP_GRID
    this.gridHeight = (this.height / this.longSide) * OP_GRID
  }

  /** Grid point from a position given as a share (0–1) of the rendered art. */
  gridFromRatio(rx: number, ry: number): [number, number] {
    return [clampToGrid(rx * this.gridWidth, this.gridWidth), clampToGrid(ry * this.gridHeight, this.gridHeight)]
  }

  gridToArt(gx: number, gy: number): [number, number] {
    const unit = this.longSide / OP_GRID
    return [this.x + gx * unit, this.y + gy * unit]
  }

  /** Canvas transform that maps art units onto a canvas with `scale` pixels per art unit. */
  artTransform(scale: number): Transform {
    return [scale, 0, 0, scale, -this.x * scale, -this.y * scale]
  }

  get artToPaintTransform(): Transform {
    return this.artTransform(this.paintScale)
  }
}
