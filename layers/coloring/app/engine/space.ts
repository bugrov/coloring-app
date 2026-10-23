import { OP_GRID } from '../../shared'
import type { ColoringArt } from '../../shared'
import { PAINT_LONG_SIDE, PAINT_SHEET_LONG_SIDE, PROGRESS_GRID_LONG_SIDE, SHEET_ASPECT } from './constants'

export type Transform = [number, number, number, number, number, number]

/** Line width in grid units for a width given as a share of the art's long side. */
export function gridLength(share: number): number {
  return Math.max(1, Math.round(share * OP_GRID))
}

/** Where the sheet lies around an art, in art units; see `sheetOf`. */
export interface Sheet {
  x: number
  y: number
  width: number
  height: number
  /** Whole progress cells added on each side of the art, horizontally and vertically. */
  marginCols: number
  marginRows: number
  /** Cells of the sheet along each axis. */
  cols: number
  rows: number
  /** Art units per cell (the progress grid spans the art's long side). */
  unit: number
}

/**
 * The sheet of an art: the art with a margin of whole progress cells on every side, so that the sheet
 * is `SHEET_ASPECT` times wider than high (or as wide as the art needs). The sizes depend on the art
 * alone: every device lays the same sheet around the same art, so a history replays alike everywhere.
 */
export function sheetOf(viewBox: ColoringArt['viewBox']): Sheet {
  const [x, y, width, height] = viewBox
  const unit = Math.max(width, height) / PROGRESS_GRID_LONG_SIDE
  const artCols = Math.max(1, Math.round(width / unit))
  const artRows = Math.max(1, Math.round(height / unit))
  const marginCols = Math.max(0, Math.ceil((SHEET_ASPECT * artRows - artCols) / 2))
  const marginRows = Math.max(0, Math.ceil((artCols / SHEET_ASPECT - artRows) / 2))

  return {
    x: x - marginCols * unit,
    y: y - marginRows * unit,
    width: width + 2 * marginCols * unit,
    height: height + 2 * marginRows * unit,
    marginCols,
    marginRows,
    cols: artCols + 2 * marginCols,
    rows: artRows + 2 * marginRows,
    unit,
  }
}

/** Grid units in one progress cell. */
const GRID_PER_CELL = OP_GRID / PROGRESS_GRID_LONG_SIDE

function clampTo(value: number, min: number, max: number): number {
  return Math.min(Math.floor(max), Math.max(Math.ceil(min), Math.round(value)))
}

/**
 * Coordinate systems of one art:
 * - art units: the SVG viewBox the paths are defined in;
 * - grid units: integers stored in ops (OP_GRID spans the art's long side, the origin is the art's
 *   top-left corner; the sheet around the art reaches into negative values and past OP_GRID);
 * - paint pixels: the paint canvas, which covers the whole sheet.
 */
export class ArtSpace {
  /** The art's viewBox. */
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly longSide: number
  readonly sheet: Sheet
  /** Paint pixels per progress cell: whole, so a cell is a block of whole pixels. */
  readonly cellPx: number
  /** Paint canvas size in pixels (the sheet). */
  readonly paintWidth: number
  readonly paintHeight: number
  /** Paint pixels per art unit. */
  readonly paintScale: number
  /** Where the art's top-left corner lies on the paint canvas, in whole pixels. */
  readonly artPaintX: number
  readonly artPaintY: number
  /** Grid units of the sheet: where it begins, and how far it reaches along each axis. */
  private readonly gridX: number
  private readonly gridY: number
  private readonly gridWidth: number
  private readonly gridHeight: number

  constructor(art: Pick<ColoringArt, 'viewBox'>) {
    const [x, y, width, height] = art.viewBox
    const sheet = sheetOf(art.viewBox)

    this.x = x
    this.y = y
    this.width = width
    this.height = height
    this.longSide = Math.max(width, height)
    this.sheet = sheet
    this.cellPx = Math.max(1, Math.min(
      Math.floor(PAINT_LONG_SIDE / PROGRESS_GRID_LONG_SIDE),
      Math.floor(PAINT_SHEET_LONG_SIDE / Math.max(sheet.cols, sheet.rows)),
    ))
    this.paintScale = this.cellPx / sheet.unit
    this.paintWidth = Math.round(sheet.width * this.paintScale)
    this.paintHeight = Math.round(sheet.height * this.paintScale)
    this.artPaintX = sheet.marginCols * this.cellPx
    this.artPaintY = sheet.marginRows * this.cellPx
    this.gridX = -sheet.marginCols * GRID_PER_CELL
    this.gridY = -sheet.marginRows * GRID_PER_CELL
    this.gridWidth = sheet.width / (this.longSide / OP_GRID)
    this.gridHeight = sheet.height / (this.longSide / OP_GRID)
  }

  /** Grid point from a position given as a share (0–1) of the rendered sheet. */
  gridFromRatio(rx: number, ry: number): [number, number] {
    return [
      clampTo(this.gridX + rx * this.gridWidth, this.gridX, this.gridX + this.gridWidth),
      clampTo(this.gridY + ry * this.gridHeight, this.gridY, this.gridY + this.gridHeight),
    ]
  }

  gridToArt(gx: number, gy: number): [number, number] {
    const unit = this.longSide / OP_GRID

    return [this.x + gx * unit, this.y + gy * unit]
  }

  /** Paint pixels of a length in grid units (a line width). */
  gridLengthToPaint(value: number): number {
    return (value * this.cellPx) / GRID_PER_CELL
  }

  /** Paint pixels of a flat list of grid points (x, y pairs). */
  gridPointsToPaint(points: readonly number[]): number[] {
    return points.map((value, index) => this.gridLengthToPaint(value - (index % 2 === 0 ? this.gridX : this.gridY)))
  }

  /** Canvas transform that maps art units onto the sheet with `scale` pixels per art unit. */
  artTransform(scale: number): Transform {
    return [scale, 0, 0, scale, -this.sheet.x * scale, -this.sheet.y * scale]
  }

  /** Canvas transform that maps the art's viewBox onto a canvas that holds the art alone. */
  artViewTransform(scale: number): Transform {
    return [scale, 0, 0, scale, -this.x * scale, -this.y * scale]
  }

  get artToPaintTransform(): Transform {
    return this.artTransform(this.paintScale)
  }
}
