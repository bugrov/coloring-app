import { isSeparator, numberMatcher } from './number'

/** 2D affine matrix [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Matrix = [number, number, number, number, number, number]

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

/** `outer · inner`: the result applies `inner` first, as nested SVG transforms do. */
export function multiply(outer: Matrix, inner: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = outer
  const [a2, b2, c2, d2, e2, f2] = inner

  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ]
}

export function isIdentity(m: Matrix): boolean {
  return m.every((value, index) => value === IDENTITY[index])
}

/** Average linear scale of a matrix; used to scale stroke widths. */
export function matrixScale([a, b, c, d]: Matrix): number {
  return Math.sqrt(Math.abs(a * d - b * c))
}

export function translation(x: number, y: number): Matrix {
  return [1, 0, 0, 1, x, y]
}

const NUMBER = numberMatcher()

/** Argument counts each transform function accepts. A Map: names must not reach prototype keys. */
const FUNCTION_ARITY = new Map<string, readonly number[]>([
  ['matrix', [6]],
  ['translate', [1, 2]],
  ['scale', [1, 2]],
  ['rotate', [1, 3]],
  ['skewX', [1]],
  ['skewY', [1]],
])

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function toMatrix(name: string, args: number[]): Matrix {
  switch (name) {
    case 'matrix':
      return args as Matrix
    case 'translate':
      return translation(args[0]!, args[1] ?? 0)
    case 'scale':
      return [args[0]!, 0, 0, args[1] ?? args[0]!, 0, 0]
    case 'rotate': {
      const angle = radians(args[0]!)
      const rotation: Matrix = [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]
      const [, cx = 0, cy = 0] = args

      return multiply(translation(cx, cy), multiply(rotation, translation(-cx, -cy)))
    }
    case 'skewX':
      return [1, 0, Math.tan(radians(args[0]!)), 1, 0, 0]
    default:
      return [1, Math.tan(radians(args[0]!)), 0, 1, 0, 0]
  }
}

/**
 * Reads a transform argument list as browsers do: numbers separated by
 * whitespace and at most one comma (or nothing, as in `1-2`); a trailing
 * comma or anything else makes the whole transform invalid.
 */
function parseArguments(text: string): number[] | null {
  const args: number[] = []
  let position = 0
  const skipWhitespace = () => {
    while (position < text.length && text[position] !== ',' && isSeparator(text[position])) position++
  }

  skipWhitespace()

  while (position < text.length) {
    NUMBER.lastIndex = position
    const match = NUMBER.exec(text)

    if (!match) return null
    args.push(Number(match[0]))
    position = NUMBER.lastIndex
    skipWhitespace()

    if (text[position] === ',') {
      position++
      skipWhitespace()

      if (position >= text.length) return null
    }
  }

  return args
}

/**
 * Parses a `transform` attribute into one matrix in a single linear pass.
 * Returns null for malformed input, which SVG treats as no transform.
 *
 * Written by hand on purpose: regex-based parsers (svgpath's included) go
 * quadratic on unbalanced parentheses in untrusted files.
 */
export function parseTransform(value: string): Matrix | null {
  let result = IDENTITY
  let position = 0

  while (position < value.length) {
    if (isSeparator(value[position])) {
      position++
      continue
    }
    const open = value.indexOf('(', position)
    const close = open === -1 ? -1 : value.indexOf(')', open)

    if (close === -1) return null

    const name = value.slice(position, open).trim()
    const args = parseArguments(value.slice(open + 1, close))

    if (!args || !FUNCTION_ARITY.get(name)?.includes(args.length) || !args.every(Number.isFinite)) return null

    result = multiply(result, toMatrix(name, args))
    position = close + 1
  }

  return result
}
