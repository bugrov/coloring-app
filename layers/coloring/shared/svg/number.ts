/** An SVG number (`-1.5e3`, `.5`, `+2`); shared by the path and transform parsers. */
const NUMBER_SOURCE = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?`

/** A sticky matcher: reads exactly one number at `lastIndex`. */
export function numberMatcher(): RegExp {
  return new RegExp(NUMBER_SOURCE, 'y')
}

const SEPARATOR = /[\s,]/

export function isSeparator(char: string | undefined): boolean {
  return char !== undefined && SEPARATOR.test(char)
}
