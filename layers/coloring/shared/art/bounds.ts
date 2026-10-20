import svgpath from 'svgpath'
import type { Bounds } from '../types'

/**
 * Axis-aligned bounds of path data. Arcs are converted to curves first and
 * curve control points are included, so the result is a cheap upper bound:
 * never smaller than the real shape, at most slightly larger.
 */
export function pathBounds(d: string): Bounds | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  svgpath(d).abs().unarc().unshort().iterate((segment, _index, x, y) => {
    const args = segment.slice(1) as number[]
    const points: number[] = segment[0] === 'H'
      ? [args[0]!, y]
      : segment[0] === 'V' ? [x, args[0]!] : args

    for (let i = 0; i + 1 < points.length; i += 2) {
      minX = Math.min(minX, points[i]!)
      minY = Math.min(minY, points[i + 1]!)
      maxX = Math.max(maxX, points[i]!)
      maxY = Math.max(maxY, points[i + 1]!)
    }
  })

  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null
}
