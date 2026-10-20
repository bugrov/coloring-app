import svgpath from 'svgpath'

const CLOSE_EPSILON = 0.01

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Applies transforms from the innermost (the element's own) to the outermost
 * ancestor, which is the order SVG composes them in.
 */
export function applyTransforms(d: string, transforms: readonly string[]): string {
  let path = svgpath(d)
  for (let i = transforms.length - 1; i >= 0; i--) {
    path = path.transform(transforms[i]!)
  }
  return path.abs().toString()
}

/** Average linear scale of the transform chain; used to scale stroke widths. */
export function transformScale(transforms: readonly string[]): number {
  const [ux, uy, vx, vy] = basisVectors(transforms)
  return Math.sqrt(Math.abs(ux * vy - uy * vx))
}

function basisVectors(transforms: readonly string[]): [number, number, number, number] {
  const coords: number[] = []
  svgpath(applyTransforms('M0 0L1 0M0 0L0 1', transforms)).iterate((segment) => {
    coords.push(Number(segment[1]), Number(segment[2]))
  })
  const [ox, oy, ux, uy, , , vx, vy] = coords
  return [ux! - ox!, uy! - oy!, vx! - ox!, vy! - oy!]
}

export function roundPath(d: string, precision: number): string {
  return svgpath(d).round(precision).toString()
}

interface PathShape {
  closed: boolean
  bounds: Bounds | null
}

/**
 * A path is closed when every subpath ends with Z or returns to its start.
 * Bounds include curve control points: a cheap upper bound, enough for
 * background detection.
 */
export function analyzePath(d: string): PathShape {
  const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  const include = (x: number, y: number) => {
    bounds.minX = Math.min(bounds.minX, x)
    bounds.minY = Math.min(bounds.minY, y)
    bounds.maxX = Math.max(bounds.maxX, x)
    bounds.maxY = Math.max(bounds.maxY, y)
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

  svgpath(d).abs().unshort().iterate((segment, _index, x, y) => {
    const command = segment[0]
    const args = segment.slice(1) as number[]
    switch (command) {
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
        for (let i = 0; i + 1 < args.length; i += 2) {
          // Arc flags/radii are not coordinates; only its end point counts.
          if (command === 'A' && i < 5) continue
          include(args[i]!, args[i + 1]!)
        }
        endX = args[args.length - 2]!
        endY = args[args.length - 1]!
    }
    include(endX, endY)
  })
  finishSubpath()

  return {
    closed,
    bounds: Number.isFinite(bounds.minX) ? bounds : null,
  }
}
