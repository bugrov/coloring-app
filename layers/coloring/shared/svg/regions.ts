import svgpath from 'svgpath'
import type { ArtInk } from '../types'
import {
  SYNTH_GAP_CLOSE_PX,
  SYNTH_GROW_PX,
  SYNTH_MAX_RING_POINTS,
  SYNTH_MIN_AREA_PX,
  SYNTH_MIN_AREA_SHARE,
  SYNTH_RASTER_SIDE,
  SYNTH_SIMPLIFY_PX,
} from './constants'
import { roundTo } from './number'

/**
 * Colourable areas found by looking at the picture, for drawings that are nothing but dark shapes
 * (outlines traced from a bitmap, strokes turned into fills): a person sees the white between the
 * lines as the areas, but the file has no shape for them. The lines are drawn into a small bitmap,
 * the empty parts that do not touch the border are the areas, and each one is traced back into a path.
 */
export interface FoundRegion {
  d: string
  bounds: [number, number, number, number]
}

/** A drawing is a list of subpaths, each a flat list of x, y pairs in bitmap pixels. */
interface Subpath {
  points: number[]
  closed: boolean
}

/** Characters an area takes besides its path data (type, id, kind, rule, bounds). */
const REGION_OVERHEAD = 110

const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const

export function findRegions(
  ink: readonly ArtInk[],
  viewBox: readonly [number, number, number, number],
  maxRegions: number,
  /** How many characters of path data the areas may take together; the largest areas come first and the rest are left out. */
  budget: number,
  checkDeadline: () => void,
): FoundRegion[] {
  const [vx, vy, vw, vh] = viewBox
  const scale = SYNTH_RASTER_SIDE / Math.max(vw, vh)
  const width = Math.max(1, Math.ceil(vw * scale))
  const height = Math.max(1, Math.ceil(vh * scale))
  const drawn = new Uint8Array(width * height)

  for (const item of ink) {
    checkDeadline()
    const subpaths = flatten(item.d, vx, vy, scale)

    if (item.fill !== null) fillPolygons(drawn, width, height, subpaths, item.fillRule)
    if (item.stroke !== null && item.strokeWidth > 0) strokeSubpaths(drawn, width, height, subpaths, Math.max(1, item.strokeWidth * scale))
  }

  // Hairline gaps would let one area flow into the next: close them before looking for the empty parts.
  const closed = dilate(drawn, width, height, SYNTH_GAP_CLOSE_PX)
  const { labels, parts } = label(closed, width, height, checkDeadline)
  const minArea = Math.max(SYNTH_MIN_AREA_PX, Math.round(width * height * SYNTH_MIN_AREA_SHARE))
  const kept = parts
    .filter(part => !part.touchesBorder && part.area >= minArea)
    .sort((a, b) => b.area - a.area)
    .slice(0, maxRegions)
  const found: FoundRegion[] = []
  let used = 0

  for (const part of kept) {
    checkDeadline()
    const ring = traceArea(labels, width, part)

    if (ring.length < 3) continue
    const points = ring.map(([x, y]) => [roundTo(vx + x / scale, 2), roundTo(vy + y / scale, 2)] as const)
    const xs = points.map(point => point[0])
    const ys = points.map(point => point[1])

    const d = `M${points.map(([x, y]) => `${x} ${y}`).join('L')}Z`

    // The cost of an item is its path plus the fixed fields around it.
    used += d.length + REGION_OVERHEAD

    if (used > budget) break

    found.push({
      d,
      bounds: [Math.floor(Math.min(...xs)), Math.floor(Math.min(...ys)), Math.ceil(Math.max(...xs)), Math.ceil(Math.max(...ys))],
    })
  }

  return found
}

/** Path data (absolute, as the pipeline writes it) as lines in bitmap pixels; curves are cut into short pieces. */
function flatten(d: string, vx: number, vy: number, scale: number): Subpath[] {
  const subpaths: Subpath[] = []
  let current: Subpath | null = null
  let startX = 0
  let startY = 0
  const toX = (x: number) => (x - vx) * scale
  const toY = (y: number) => (y - vy) * scale
  const add = (x: number, y: number) => {
    current?.points.push(toX(x), toY(y))
  }

  svgpath(d).abs().unarc().unshort().iterate((segment, _index, x, y) => {
    const args = segment.slice(1) as number[]

    switch (segment[0]) {
      case 'M':
        current = { points: [], closed: false }
        subpaths.push(current)
        startX = args[0]!
        startY = args[1]!
        add(startX, startY)
        break
      case 'L':
        add(args[0]!, args[1]!)
        break
      case 'H':
        add(args[0]!, y)
        break
      case 'V':
        add(x, args[0]!)
        break
      case 'C':
        curve(x, y, args, 3, scale, add)
        break
      case 'Q':
        curve(x, y, args, 2, scale, add)
        break
      case 'Z':
        if (current) current.closed = true
        // A later segment without its own move starts again where the shape began.
        current = { points: [], closed: false }
        subpaths.push(current)
        add(startX, startY)
        break
      default:
        break
    }
  })

  return subpaths.filter(subpath => subpath.points.length >= 4)
}

/** Adds the points of a quadratic (order 2) or cubic (order 3) curve after its start (x0, y0). */
function curve(x0: number, y0: number, args: number[], order: 2 | 3, scale: number, add: (x: number, y: number) => void) {
  const xs = [x0]
  const ys = [y0]

  for (let i = 0; i < order; i++) {
    xs.push(args[i * 2]!)
    ys.push(args[i * 2 + 1]!)
  }
  let length = 0

  for (let i = 1; i <= order; i++) length += Math.hypot(xs[i]! - xs[i - 1]!, ys[i]! - ys[i - 1]!) * scale
  const steps = Math.min(48, Math.max(3, Math.ceil(length / 3)))

  for (let step = 1; step <= steps; step++) {
    const t = step / steps
    const u = 1 - t

    if (order === 3) {
      add(
        u * u * u * xs[0]! + 3 * u * u * t * xs[1]! + 3 * u * t * t * xs[2]! + t * t * t * xs[3]!,
        u * u * u * ys[0]! + 3 * u * u * t * ys[1]! + 3 * u * t * t * ys[2]! + t * t * t * ys[3]!,
      )
    } else {
      add(u * u * xs[0]! + 2 * u * t * xs[1]! + t * t * xs[2]!, u * u * ys[0]! + 2 * u * t * ys[1]! + t * t * ys[2]!)
    }
  }
}

/** Fills the inside of all the subpaths together, by the non-zero or the even-odd rule, one scanline at a time. */
function fillPolygons(bitmap: Uint8Array, width: number, height: number, subpaths: readonly Subpath[], rule: 'nonzero' | 'evenodd') {
  const edges: number[] = []

  for (const { points } of subpaths) {
    const count = points.length / 2

    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count

      edges.push(points[i * 2]!, points[i * 2 + 1]!, points[next * 2]!, points[next * 2 + 1]!)
    }
  }
  fillEdges(bitmap, width, height, edges, rule)
}

function fillEdges(bitmap: Uint8Array, width: number, height: number, edges: readonly number[], rule: 'nonzero' | 'evenodd') {
  let top = Infinity
  let bottom = -Infinity

  for (let i = 1; i < edges.length; i += 2) {
    top = Math.min(top, edges[i]!)
    bottom = Math.max(bottom, edges[i]!)
  }
  const firstRow = Math.max(0, Math.floor(top))
  const lastRow = Math.min(height - 1, Math.ceil(bottom))
  // Edges by the first row whose centre they cross, so a row only looks at the edges that are alive on it.
  const starting: number[][] = Array.from({ length: lastRow - firstRow + 1 }, () => [])

  for (let i = 0; i < edges.length; i += 4) {
    const y0 = edges[i + 1]!
    const y1 = edges[i + 3]!

    if (y0 === y1) continue
    const first = Math.max(firstRow, Math.ceil(Math.min(y0, y1) - 0.5))

    if (first <= lastRow) starting[first - firstRow]!.push(i)
  }
  let active: number[] = []

  for (let row = firstRow; row <= lastRow; row++) {
    const centre = row + 0.5

    active = active.filter((edge) => {
      const y0 = edges[edge + 1]!
      const y1 = edges[edge + 3]!

      return centre < Math.max(y0, y1)
    })
    active.push(...starting[row - firstRow]!)

    const crossings: Array<[number, number]> = []

    for (const edge of active) {
      const x0 = edges[edge]!
      const y0 = edges[edge + 1]!
      const x1 = edges[edge + 2]!
      const y1 = edges[edge + 3]!

      if (centre < Math.min(y0, y1) || centre >= Math.max(y0, y1)) continue
      crossings.push([x0 + ((centre - y0) / (y1 - y0)) * (x1 - x0), y1 > y0 ? 1 : -1])
    }
    crossings.sort((a, b) => a[0] - b[0])

    let winding = 0

    for (let i = 0; i + 1 < crossings.length; i++) {
      winding = rule === 'nonzero' ? winding + crossings[i]![1] : winding ^ 1

      if (winding === 0) continue
      const from = Math.max(0, Math.ceil(crossings[i]![0] - 0.5))
      const to = Math.min(width, Math.ceil(crossings[i + 1]![0] - 0.5))

      if (to > from) bitmap.fill(1, row * width + from, row * width + to)
    }
  }
}

/** Draws every segment as a bar of the stroke's width with square ends (they also cover the corners). */
function strokeSubpaths(bitmap: Uint8Array, width: number, height: number, subpaths: readonly Subpath[], thickness: number) {
  const half = thickness / 2

  for (const { points, closed } of subpaths) {
    const count = points.length / 2
    const last = closed ? count : count - 1

    for (let i = 0; i < last; i++) {
      const next = (i + 1) % count
      const x0 = points[i * 2]!
      const y0 = points[i * 2 + 1]!
      const x1 = points[next * 2]!
      const y1 = points[next * 2 + 1]!
      const length = Math.hypot(x1 - x0, y1 - y0)

      if (length === 0) continue
      const ux = ((x1 - x0) / length) * half
      const uy = ((y1 - y0) / length) * half
      const ax = x0 - ux
      const ay = y0 - uy
      const bx = x1 + ux
      const by = y1 + uy

      fillEdges(bitmap, width, height, [
        ax - uy, ay + ux, bx - uy, by + ux,
        bx - uy, by + ux, bx + uy, by - ux,
        bx + uy, by - ux, ax + uy, ay - ux,
        ax + uy, ay - ux, ax - uy, ay + ux,
      ], 'nonzero')
    }
  }
}

/** Grows the marked pixels by `steps` pixels in the four directions. */
function dilate(source: Uint8Array, width: number, height: number, steps: number): Uint8Array {
  let current = source

  for (let step = 0; step < steps; step++) {
    const next = new Uint8Array(current)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x

        if (current[index] === 1) continue
        if ((x > 0 && current[index - 1] === 1) || (x < width - 1 && current[index + 1] === 1) || (y > 0 && current[index - width] === 1) || (y < height - 1 && current[index + width] === 1)) {
          next[index] = 1
        }
      }
    }
    current = next
  }

  return current
}

interface Part {
  id: number
  area: number
  touchesBorder: boolean
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Numbers the connected empty parts of the bitmap (1, 2, ...); drawn pixels stay 0. */
function label(drawn: Uint8Array, width: number, height: number, checkDeadline: () => void) {
  const labels = new Int32Array(width * height)
  const parts: Part[] = []
  const stack = new Int32Array(width * height)

  for (let start = 0; start < labels.length; start++) {
    if (drawn[start] === 1 || labels[start] !== 0) continue
    if (start % width === 0) checkDeadline()

    const id = parts.length + 1
    const part: Part = { id, area: 0, touchesBorder: false, minX: width, minY: height, maxX: 0, maxY: 0 }
    let top = 0

    stack[top++] = start
    labels[start] = id

    while (top > 0) {
      const index = stack[--top]!
      const x = index % width
      const y = (index - x) / width

      part.area++
      part.minX = Math.min(part.minX, x)
      part.maxX = Math.max(part.maxX, x)
      part.minY = Math.min(part.minY, y)
      part.maxY = Math.max(part.maxY, y)

      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) part.touchesBorder = true

      for (const next of [x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, y > 0 ? index - width : -1, y < height - 1 ? index + width : -1]) {
        if (next < 0 || drawn[next] === 1 || labels[next] !== 0) continue
        labels[next] = id
        stack[top++] = next
      }
    }
    parts.push(part)
  }

  return { labels, parts }
}

/**
 * The outline of one part, grown a little (so that it goes under the lines and leaves no seam
 * between paint and line), as a simplified ring of points in bitmap pixels.
 */
function traceArea(labels: Int32Array, width: number, part: Part): Array<[number, number]> {
  const pad = SYNTH_GROW_PX + 1
  const localWidth = part.maxX - part.minX + 1 + pad * 2
  const localHeight = part.maxY - part.minY + 1 + pad * 2
  let local: Uint8Array = new Uint8Array(localWidth * localHeight)

  for (let y = part.minY; y <= part.maxY; y++) {
    for (let x = part.minX; x <= part.maxX; x++) {
      if (labels[y * width + x] === part.id) local[(y - part.minY + pad) * localWidth + (x - part.minX + pad)] = 1
    }
  }
  local = dilate(local, localWidth, localHeight, SYNTH_GROW_PX)

  const ring = followOutline(local, localWidth, localHeight)

  let tolerance = SYNTH_SIMPLIFY_PX
  let simplified = simplifyRing(ring, tolerance)

  // A jagged outline is simplified more until it is within the limit.
  while (simplified.length > SYNTH_MAX_RING_POINTS && tolerance < 64) {
    tolerance *= 2
    simplified = simplifyRing(simplified, tolerance)
  }

  return simplified.map(([x, y]) => [x + part.minX - pad, y + part.minY - pad])
}

/** The outer border of the marked pixels, as the corners of the pixel edges, walked with the marked side on the right. */
function followOutline(marked: Uint8Array, width: number, height: number): Array<[number, number]> {
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && marked[y * width + x] === 1
  let startX = -1
  let startY = -1

  for (let index = 0; index < marked.length && startX < 0; index++) {
    if (marked[index] === 1) {
      startX = index % width
      startY = (index - startX) / width
    }
  }

  if (startX < 0) return []

  const ring: Array<[number, number]> = [[startX, startY]]
  let x = startX
  let y = startY
  let direction = 0

  for (let steps = 0; steps < 4 * (width + 1) * (height + 1); steps++) {
    x += DIRECTIONS[direction]![0]
    y += DIRECTIONS[direction]![1]

    // The two pixels ahead of the walker, on its left and its right.
    const [frontLeft, frontRight] = [
      [filled(x, y - 1), filled(x, y)],
      [filled(x, y), filled(x - 1, y)],
      [filled(x - 1, y), filled(x - 1, y - 1)],
      [filled(x - 1, y - 1), filled(x, y - 1)],
    ][direction]! as [boolean, boolean]
    const next = !frontRight ? (direction + 1) % 4 : frontLeft ? (direction + 3) % 4 : direction

    if (next !== direction) ring.push([x, y])
    direction = next

    if (x === startX && y === startY && direction === 0) break
  }

  return ring
}

/** Douglas-Peucker for a closed ring: split at the two points that are furthest apart, simplify each half. */
function simplifyRing(ring: Array<[number, number]>, tolerance: number): Array<[number, number]> {
  if (ring.length <= 4) return ring
  const first = 0
  let far = 0
  let best = -1

  for (let i = 1; i < ring.length; i++) {
    const distance = Math.hypot(ring[i]![0] - ring[first]![0], ring[i]![1] - ring[first]![1])

    if (distance > best) {
      best = distance
      far = i
    }
  }
  const one = simplifyLine(ring.slice(first, far + 1), tolerance)
  const two = simplifyLine([...ring.slice(far), ring[first]!], tolerance)

  return [...one.slice(0, -1), ...two.slice(0, -1)]
}

function simplifyLine(line: Array<[number, number]>, tolerance: number): Array<[number, number]> {
  if (line.length <= 2) return line
  const keep = new Uint8Array(line.length)
  const stack: Array<[number, number]> = [[0, line.length - 1]]

  keep[0] = 1
  keep[line.length - 1] = 1

  while (stack.length > 0) {
    const [from, to] = stack.pop()!
    const [ax, ay] = line[from]!
    const [bx, by] = line[to]!
    const length = Math.hypot(bx - ax, by - ay)
    let worst = -1
    let index = -1

    for (let i = from + 1; i < to; i++) {
      const [px, py] = line[i]!
      const distance = length === 0 ? Math.hypot(px - ax, py - ay) : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length

      if (distance > worst) {
        worst = distance
        index = i
      }
    }

    if (worst > tolerance && index > 0) {
      keep[index] = 1
      stack.push([from, index], [index, to])
    }
  }

  return line.filter((_, i) => keep[i] === 1)
}
