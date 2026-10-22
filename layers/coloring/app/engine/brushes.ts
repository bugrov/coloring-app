import { parseColor } from '../../shared'
import type { Rgb } from '../../shared'
import { context2d, createCanvas, type AnyCanvas, type AnyContext } from './canvas'
import { BRUSH_HARDNESS, PENCIL_GRAIN_LIGHTEN, PENCIL_GRAIN_TILE } from './constants'

/** Fixed seed: the grain must look the same after a reload and on replay. */
const GRAIN_SEED = 0x2F_6B_43

/** Small deterministic PRNG (mulberry32). */
function random(seed: number): () => number {
  let state = seed

  return () => {
    state = (state + 0x6D_2B_79_F5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t

    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

const BLACK: Rgb = { r: 0, g: 0, b: 0 }

/**
 * Caches per-colour drawing resources: a grainy pattern for the pencil and a
 * soft round stamp for the brush. Both are built once and reused, so drawing
 * a frame only issues path and drawImage calls.
 */
export class BrushCache {
  private readonly patterns = new Map<string, CanvasPattern>()
  private readonly stamps = new Map<string, AnyCanvas>()

  pencilPattern(ctx: AnyContext, color: string): CanvasPattern {
    let pattern = this.patterns.get(color)

    if (!pattern) {
      const tile = createCanvas(PENCIL_GRAIN_TILE, PENCIL_GRAIN_TILE)
      const tileContext = context2d(tile)
      const image = tileContext.createImageData(PENCIL_GRAIN_TILE, PENCIL_GRAIN_TILE)
      const { r, g, b } = parseColor(color) ?? BLACK
      const next = random(GRAIN_SEED)

      for (let i = 0; i < image.data.length; i += 4) {
        const lighten = PENCIL_GRAIN_LIGHTEN * next()

        image.data[i] = r + (255 - r) * lighten
        image.data[i + 1] = g + (255 - g) * lighten
        image.data[i + 2] = b + (255 - b) * lighten
        image.data[i + 3] = 255
      }
      tileContext.putImageData(image, 0, 0)
      pattern = ctx.createPattern(tile, 'repeat')!
      this.patterns.set(color, pattern)
    }

    return pattern
  }

  brushStamp(color: string, diameter: number): AnyCanvas {
    const size = Math.max(2, Math.ceil(diameter))
    const key = `${color}:${size}`
    let stamp = this.stamps.get(key)

    if (!stamp) {
      stamp = createCanvas(size, size)
      const ctx = context2d(stamp)
      const radius = size / 2
      const { r, g, b } = parseColor(color) ?? BLACK
      const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius)

      gradient.addColorStop(0, `rgb(${r} ${g} ${b} / 100%)`)
      gradient.addColorStop(BRUSH_HARDNESS, `rgb(${r} ${g} ${b} / 100%)`)
      gradient.addColorStop(1, `rgb(${r} ${g} ${b} / 0%)`)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, size, size)
      this.stamps.set(key, stamp)
    }

    return stamp
  }
}
