import { describe, expect, it } from 'vitest'
import { OP_GRID } from '../../../../layers/coloring/shared'
import { OP_GRID_REACH } from '../../../../layers/coloring/shared/ops/constants'
import { HoldDetector } from '../../../../layers/coloring/app/engine/hold'
import { computeProgress, regionCode } from '../../../../layers/coloring/app/engine/progress'
import { ArtSpace, sheetOf } from '../../../../layers/coloring/app/engine/space'
import { StampWalker } from '../../../../layers/coloring/app/engine/stamps'
import { clampView, panBy, zoomAt } from '../../../../layers/coloring/app/engine/viewport'

describe('StampWalker', () => {
  it('stamps the first point and then every `spacing` along the line', () => {
    expect(new StampWalker(5).walk([0, 0, 12, 0])).toEqual([0, 0, 5, 0, 10, 0])
  })

  it('gives the same stamps whether a stroke arrives in chunks or at once', () => {
    const points = [0, 0, 3, 4, 10, 4, 10, 20, 2, 25]
    const whole = new StampWalker(2.5).walk(points)

    const chunked = new StampWalker(2.5)
    const pieces = [...chunked.walk(points.slice(0, 4)), ...chunked.walk(points.slice(4, 6)), ...chunked.walk(points.slice(6))]

    expect(pieces.map(n => n.toFixed(6))).toEqual(whole.map(n => n.toFixed(6)))
  })
})

describe('HoldDetector', () => {
  it('stays pending while the pointer stays within the tolerance', () => {
    const hold = new HoldDetector(6)

    hold.start(100, 100)

    expect(hold.move(103, 104)).toBe(true)
    expect(hold.pending).toBe(true)
  })

  it('turns into a stroke once the pointer moves too far, even if it comes back', () => {
    const hold = new HoldDetector(6)

    hold.start(100, 100)
    hold.move(110, 100)

    expect(hold.move(100, 100)).toBe(false)
    expect(hold.pending).toBe(false)
  })
})

describe('computeProgress', () => {
  it('weights regions by area', () => {
    expect(computeProgress([100, 300], [100, 0])).toEqual({ percent: 25, complete: false })
  })

  it('counts nearly finished regions as complete so 100% is reachable by hand', () => {
    expect(computeProgress([100, 100], [96, 95])).toEqual({ percent: 100, complete: true })
  })

  it('takes the tolerance of the administrator instead of the default', () => {
    expect(computeProgress([100, 100], [80, 80], 0.8)).toEqual({ percent: 100, complete: true })
    expect(computeProgress([100, 100], [80, 80])).toEqual({ percent: 80, complete: false })
  })

  it('never shows 100% before every region is complete', () => {
    expect(computeProgress([1000, 10], [1000, 0]).percent).toBe(99)
  })

  it('ignores regions too small to have any cells', () => {
    expect(computeProgress([0, 50], [0, 50])).toEqual({ percent: 100, complete: true })
  })

  it('reports zero for an art without countable area', () => {
    expect(computeProgress([], [])).toEqual({ percent: 0, complete: false })
  })
})

describe('regionCode', () => {
  it('gives distinct non-zero colours to every region', () => {
    const codes = new Set(Array.from({ length: 500 }, (_, index) => regionCode(index)))

    expect(codes.size).toBe(500)
    expect(codes.has(0)).toBe(false)
  })
})

describe('ArtSpace', () => {
  const space = new ArtSpace({ viewBox: [10, 20, 800, 400] })

  it('covers the sheet around the art with the paint canvas, in whole cells', () => {
    expect([space.paintWidth, space.paintHeight]).toEqual([2256, 1024])
    // The art keeps its place inside: 13 cells of 8 px of margin on each side.
    expect([space.artPaintX, space.artPaintY]).toEqual([104, 0])
    expect(space.cellPx).toBe(8)
  })

  it('maps positions on the rendered sheet to integer grid units within its bounds', () => {
    // The middle of the sheet is the middle of the art; the sheet reaches 208 grid units before the art.
    expect(space.gridFromRatio(0.5, 0.5)).toEqual([2048, 1024])
    expect(space.gridFromRatio(-0.1, 1.2)).toEqual([-208, 2048])
  })

  it('turns grid points into paint pixels from the sheet corner', () => {
    expect(space.gridPointsToPaint([0, 0, 4096, 2048])).toEqual([104, 0, 104 + 2048, 1024])
    expect(space.gridLengthToPaint(16)).toBe(8)
  })

  it('maps grid units back to art units', () => {
    expect(space.gridToArt(4096, 2048)).toEqual([810, 420])
  })
})

describe('sheetOf', () => {
  it.each<[string, [number, number, number, number]]>([
    ['wide', [0, 0, 800, 400]],
    ['square', [0, 0, 500, 500]],
    ['tall', [0, 0, 300, 900]],
    ['very wide', [5, 5, 2000, 400]],
  ])('lays a %s art on a sheet 2.2 times as wide as it is high, art in the middle', (_name, viewBox) => {
    const sheet = sheetOf(viewBox)
    const [x, y, width, height] = viewBox

    expect(sheet.width / sheet.height).toBeGreaterThan(2.1)
    expect(sheet.width / sheet.height).toBeLessThan(2.3)
    expect(sheet.x).toBeLessThanOrEqual(x)
    expect(sheet.y).toBeLessThanOrEqual(y)
    expect(sheet.x + sheet.width).toBeGreaterThanOrEqual(x + width)
    expect(sheet.y + sheet.height).toBeGreaterThanOrEqual(y + height)
    expect(x - sheet.x).toBeCloseTo(sheet.x + sheet.width - (x + width))
    expect(y - sheet.y).toBeCloseTo(sheet.y + sheet.height - (y + height))
  })

  it.each<[string, [number, number, number, number]]>([
    ['a very tall art', [0, 0, 1, 1000]],
    ['a very wide art', [0, 0, 1000, 1]],
    ['a square art', [0, 0, 500, 500]],
  ])('keeps every position of the sheet within what an op may hold (%s)', (_name, viewBox) => {
    const space = new ArtSpace({ viewBox })

    for (const [rx, ry] of [[0, 0], [1, 1], [0, 1], [1, 0]] as const) {
      for (const value of space.gridFromRatio(rx, ry)) {
        expect(value).toBeGreaterThanOrEqual(-OP_GRID_REACH)
        expect(value).toBeLessThanOrEqual(OP_GRID + OP_GRID_REACH)
      }
    }
  })

  it('keeps the pixels of the canvas near what a plain art took', () => {
    for (const viewBox of [[0, 0, 800, 400], [0, 0, 500, 500], [0, 0, 300, 900]] satisfies [number, number, number, number][]) {
      const space = new ArtSpace({ viewBox })

      expect(space.paintWidth * space.paintHeight).toBeLessThan(2048 * 2048)
    }
  })
})

describe('viewport', () => {
  const W = 400
  const H = 200

  it('keeps the point under the fingers in place while zooming', () => {
    const view = zoomAt({ scale: 1, x: 0, y: 0 }, 2, 100, 50, W, H)

    expect(view).toEqual({ scale: 2, x: -100, y: -50 })
    // Content point under (100, 50) is still (100 - x) / scale = 100.
    expect((100 - view.x) / view.scale).toBe(100)
  })

  it('lets a sheet wider than the stage be moved at scale 1, and keeps its edges out of the stage', () => {
    // The sheet is 600 wide on a stage 400 wide: it starts 100 left of the stage.
    const area = { x: -100, y: 0, width: 600, height: H }

    expect(panBy({ scale: 1, x: 0, y: 0 }, 60, 0, W, H, area).x).toBe(60)
    expect(panBy({ scale: 1, x: 0, y: 0 }, 500, 0, W, H, area).x).toBe(100)
    expect(panBy({ scale: 1, x: 0, y: 0 }, -500, 0, W, H, area).x).toBe(-100)
    // Without the area the old rule holds: nothing to move at scale 1.
    expect(panBy({ scale: 1, x: 0, y: 0 }, 60, 0, W, H).x).toBe(0)
  })

  it('keeps a sheet narrower than the stage in the middle', () => {
    const area = { x: 50, y: 0, width: 300, height: H }

    expect(clampView({ scale: 1, x: 40, y: 0 }, W, H, area).x).toBe(0)
  })

  it('limits zoom and never shows empty space around the art', () => {
    expect(zoomAt({ scale: 1, x: 0, y: 0 }, 0.5, 0, 0, W, H)).toEqual({ scale: 1, x: 0, y: 0 })
    expect(zoomAt({ scale: 4, x: 0, y: 0 }, 10, 0, 0, W, H).scale).toBe(5)
    expect(panBy({ scale: 2, x: 0, y: 0 }, 50, -1000, W, H)).toEqual({ scale: 2, x: 0, y: -200 })
    expect(clampView({ scale: 1, x: -30, y: 10 }, W, H)).toEqual({ scale: 1, x: 0, y: 0 })
  })
})
