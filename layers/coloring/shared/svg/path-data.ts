import { isSeparator, numberMatcher } from './number'

/** Parameters per path command (lower and upper case alike). */
const COMMAND_ARITY = new Map<string, number>([
  ['m', 2], ['l', 2], ['h', 1], ['v', 1], ['c', 6], ['s', 4], ['q', 4], ['t', 2], ['a', 7], ['z', 0],
])

/** Arc parameters 3 and 4 are flags: a single 0/1 that may be written without separators. */
const ARC_FLAGS = new Set([3, 4])

const NUMBER = numberMatcher()

/**
 * Rewrites path data so every command has an explicit letter
 * (`L1 1 2 2` → `L1 1L2 2`), in one linear pass.
 *
 * Like browsers, data after the first error is dropped and the valid part
 * before it is kept. Returns null when nothing valid precedes the error or
 * the data does not start with a move.
 *
 * svgpath expands implicitly repeated commands with a quadratic loop, so
 * untrusted data goes through this first; afterwards every segment it parses
 * has exactly its own parameters.
 */
export function explicitPathData(d: string): string | null {
  const out: string[] = []
  let position = 0
  let command = ''

  const skipSeparators = () => {
    while (isSeparator(d[position])) position++
  }

  /** Reads the parameters of `command` at the current position; null on an error. */
  const readParams = (): string[] | null => {
    const params: string[] = []
    const isArc = command === 'a' || command === 'A'
    for (let index = 0; index < COMMAND_ARITY.get(command.toLowerCase())!; index++) {
      skipSeparators()
      if (isArc && ARC_FLAGS.has(index)) {
        const flag = d[position]
        if (flag !== '0' && flag !== '1') return null
        params.push(flag)
        position++
        continue
      }
      NUMBER.lastIndex = position
      const match = NUMBER.exec(d)
      if (!match) return null
      params.push(match[0])
      position = NUMBER.lastIndex
    }
    return params
  }

  while (true) {
    skipSeparators()
    if (position >= d.length) break

    const char = d[position]!
    if (COMMAND_ARITY.has(char.toLowerCase())) {
      command = char
      position++
    }
    else if (!command || command === 'z' || command === 'Z') {
      // Numbers must follow a command; nothing may follow Z without a new command.
      break
    }
    else if (command === 'M') {
      command = 'L'
    }
    else if (command === 'm') {
      command = 'l'
    }

    const params = readParams()
    if (!params) break
    out.push(command + params.join(' '))
  }

  return out.length > 0 && (out[0]![0] === 'M' || out[0]![0] === 'm') ? out.join('') : null
}
