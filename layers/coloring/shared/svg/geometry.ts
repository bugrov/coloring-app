import svgpath from 'svgpath'
import type { Bounds } from '../types'
import { explicitPathData } from './path-data'
import { isIdentity, type Matrix } from './transform'

const CLOSE_EPSILON = 0.01

export interface ProcessedPath {
  /** Absolute, rounded path data with an explicit letter for every command. */
  d: string
  /** Upper bound of the shape (curve control points included). */
  bounds: Bounds | null
  /** Every subpath ends with Z or returns to its start. */
  closed: boolean
  /** The data had an error; only the valid part before it was kept. */
  truncated: boolean
}

/**
 * Transforms, rounds and measures path data with a single parse. Returns
 * null for malformed data. The output keeps explicit command letters so any
 * later parse (the engine on the client) stays linear too.
 */
export function processPath(raw: string, matrix: Matrix, precision: number): ProcessedPath | null {
  const explicit = explicitPathData(raw)

  if (explicit === null) return null

  const path = svgpath(explicit.data)

  if (!isIdentity(matrix)) path.matrix(matrix)
  path.abs().round(precision)

  const commands: string[] = []

  path.iterate((segment) => {
    commands.push(segment[0] + segment.slice(1).join(' '))
  })

  const shape = measure(path.unarc().unshort())

  return { d: commands.join(''), ...shape, truncated: explicit.truncated }
}

/** Bounds and closedness in one pass over an absolute path without arcs. */
function measure(path: ReturnType<typeof svgpath>): Pick<ProcessedPath, 'bounds' | 'closed'> {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const include = (x: number, y: number) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  let closed = true
  let subpathOpen = false
  let startX = 0
  let startY = 0
  let endX = 0
  let endY = 0
  const finishSubpath = () => {
    if (subpathOpen && (Math.abs(endX - startX) > CLOSE_EPSILON || Math.abs(endY - startY) > CLOSE_EPSILON)) {
      closed = false
    }
    subpathOpen = false
  }

  path.iterate((segment, _index, x, y) => {
    const args = segment.slice(1) as number[]

    switch (segment[0]) {
      case 'M':
        finishSubpath()
        startX = endX = args[0]!
        startY = endY = args[1]!
        subpathOpen = true
        break
      case 'Z':
      case 'z':
        endX = startX
        endY = startY
        subpathOpen = false
        break
      case 'H':
        endX = args[0]!
        endY = y
        break
      case 'V':
        endX = x
        endY = args[0]!
        break
      default:
        for (let i = 0; i + 1 < args.length; i += 2) include(args[i]!, args[i + 1]!)
        endX = args[args.length - 2]!
        endY = args[args.length - 1]!
    }
    include(endX, endY)
  })
  finishSubpath()

  return { closed, bounds: Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null }
}
