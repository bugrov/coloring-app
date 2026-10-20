export interface Rgb {
  r: number
  g: number
  b: number
}

// Enough for hand-written and exported SVGs; unknown names are reported as
// unparseable and handled by the caller.
// A Map, not an object literal: lookups must not reach prototype keys such as `constructor`.
const NAMED_COLORS = new Map(Object.entries({
  black: '#000000',
  white: '#ffffff',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  orange: '#ffa500',
  purple: '#800080',
  pink: '#ffc0cb',
  brown: '#a52a2a',
  navy: '#000080',
}))

const clampByte = (value: number) => Math.min(255, Math.max(0, Math.round(value)))

/** Parses `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()` and basic names. Alpha is ignored. */
export function parseColor(value: string): Rgb | null {
  const input = value.trim().toLowerCase()
  const hex = NAMED_COLORS.get(input) ?? input

  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])[0-9a-f]?$/.exec(hex)
  if (short) {
    const [r, g, b] = short.slice(1, 4).map(digit => Number.parseInt(digit + digit, 16))
    return { r: r!, g: g!, b: b! }
  }

  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})(?:[0-9a-f]{2})?$/.exec(hex)
  if (long) {
    const [r, g, b] = long.slice(1, 4).map(pair => Number.parseInt(pair, 16))
    return { r: r!, g: g!, b: b! }
  }

  const functional = /^rgba?\(\s*([\d.]+)(%?)[\s,]+([\d.]+)(%?)[\s,]+([\d.]+)(%?)/.exec(input)
  if (functional) {
    const channel = (amount: string, percent: string) =>
      clampByte(percent ? (Number(amount) * 255) / 100 : Number(amount))
    return {
      r: channel(functional[1]!, functional[2]!),
      g: channel(functional[3]!, functional[4]!),
      b: channel(functional[5]!, functional[6]!),
    }
  }

  return null
}

export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join('')}`
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const linear = (channel: number) => {
    const c = channel / 255
    return c <= 0.039_28 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}
