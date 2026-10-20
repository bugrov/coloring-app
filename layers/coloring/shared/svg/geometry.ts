import svgpath from 'svgpath'

const CLOSE_EPSILON = 0.01

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

/** A path is closed when every subpath ends with Z or returns to its start. */
export function isClosedPath(d: string): boolean {
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
        endX = args[args.length - 2]!
        endY = args[args.length - 1]!
    }
  })
  finishSubpath()

  return closed
}
