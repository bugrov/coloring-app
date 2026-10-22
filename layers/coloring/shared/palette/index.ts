import { PALETTE } from './constants'
import type { PaletteColor } from '../types'

export { DEFAULT_COLOR, PALETTE } from './constants'

/** An independent copy of a palette: editing the copy never touches the original. */
export function clonePalette(palette: readonly PaletteColor[] = PALETTE): PaletteColor[] {
  return palette.map(color => ({ ...color }))
}
