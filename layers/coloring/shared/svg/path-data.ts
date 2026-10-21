/** Parameters per path command (lower and upper case alike). */
const ARITY = new Map<string, number>([
  ['m', 2], ['l', 2], ['h', 1], ['v', 1], ['c', 6], ['s', 4], ['q', 4], ['t', 2], ['a', 7], ['z', 0],
])

/** Arc parameters 3 and 4 are flags: a single 0/1 that may be written without separators. */
const ARC_FLAGS = new Set([3, 4])

const NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y
const SEPARATOR = /[\s,]/

/**
 * Rewrites path data so every command has an explicit letter
 * (`L1 1 2 2` → `L1 1L2 2`), in one linear pass. Returns null for malformed
 * data.
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
    while (position < d.length && SEPARATOR.test(d[position]!)) position++
  }

  while (true) {
    skipSeparators()
    if (position >= d.length) break

    const char = d[position]!
    const arity = ARITY.get(char.toLowerCase())
    if (arity !== undefined) {
      command = char
      position++
    }
    else if (!command || command === 'z' || command === 'Z') {
      // Numbers must follow a command; nothing may follow Z without a new command.
      return null
    }
    else if (command === 'M') {
      command = 'L'
    }
    else if (command === 'm') {
      command = 'l'
    }

    const count = ARITY.get(command.toLowerCase())!
    const params: string[] = []
    for (let index = 0; index < count; index++) {
      skipSeparators()
      if (command.toLowerCase() === 'a' && ARC_FLAGS.has(index)) {
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
    out.push(command + params.join(' '))
  }

  return out.length > 0 && (out[0]![0] === 'M' || out[0]![0] === 'm') ? out.join('') : null
}
