import { isValidPathData } from './schema'
import type { ColoringArt } from '../types'

const HEX_COLOR = /^#[0-9a-f]{6}$/
const safeColor = (color: string | null) => (color !== null && HEX_COLOR.test(color) ? color : 'none')

/**
 * A standalone SVG document of the art for `<img>` thumbnails, built only from the normalized
 * structure: numbers, enums, `#rrggbb` colours and path data that passed the whitelist. No source
 * markup, text or URLs can get in. Regions are white and ink is drawn in its colours, in z-order.
 */
export function artToSvg(art: ColoringArt): string {
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${art.viewBox.join(' ')}">`]
  for (const item of art.items) {
    // Stored data was validated on the way in; this keeps markup safe even if a row was tampered with.
    if (!isValidPathData(item.d)) continue
    if (item.type === 'region') {
      parts.push(`<path d="${item.d}" fill="#fff" fill-rule="${item.fillRule}"/>`)
    }
    else {
      parts.push(
        `<path d="${item.d}" fill="${safeColor(item.fill)}" fill-rule="${item.fillRule}" stroke="${safeColor(item.stroke)}"`
        + ` stroke-width="${item.strokeWidth}" stroke-linecap="${item.lineCap}" stroke-linejoin="${item.lineJoin}"`
        + ` stroke-miterlimit="${item.miterLimit}"/>`,
      )
    }
  }
  parts.push('</svg>')
  return parts.join('')
}
