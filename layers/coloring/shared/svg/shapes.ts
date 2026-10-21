import type { Element } from '@xmldom/xmldom'
import { roundTo } from './number'

/** Numeric attribute; lengths with `px` are accepted, other units are not. */
export function numberAttr(element: Element, name: string, fallback = 0): number {
  const raw = element.getAttribute(name)?.trim()
  if (!raw) return fallback
  const value = Number.parseFloat(raw.endsWith('px') ? raw.slice(0, -2) : raw)
  return Number.isFinite(value) ? value : fallback
}

/** Decimals kept when shapes are converted to paths: removes float artefacts (0.30000000000000004 → 0.3). */
const SHAPE_DIGITS = 6

function tidy(value: number): number {
  return roundTo(value, SHAPE_DIGITS)
}

function pointsToPath(points: string, close: boolean): string | null {
  const numbers = points.trim().split(/[\s,]+/).map(Number)
  if (numbers.length < 4 || numbers.some(n => !Number.isFinite(n))) return null
  const pairs: string[] = []
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    pairs.push(`${numbers[i]} ${numbers[i + 1]}`)
  }
  return `M${pairs.join('L')}${close ? 'Z' : ''}`
}

function rectToPath(element: Element): string | null {
  const x = numberAttr(element, 'x')
  const y = numberAttr(element, 'y')
  const width = numberAttr(element, 'width')
  const height = numberAttr(element, 'height')
  if (width <= 0 || height <= 0) return null

  // Per SVG, a missing rx/ry takes the other's value; both are clamped to half the side.
  const rxAttr = element.hasAttribute('rx') ? numberAttr(element, 'rx') : null
  const ryAttr = element.hasAttribute('ry') ? numberAttr(element, 'ry') : null
  const rx = Math.min(Math.max(rxAttr ?? ryAttr ?? 0, 0), width / 2)
  const ry = Math.min(Math.max(ryAttr ?? rxAttr ?? 0, 0), height / 2)

  if (rx === 0 || ry === 0) {
    return `M${x} ${y}H${tidy(x + width)}V${tidy(y + height)}H${x}Z`
  }
  return [
    `M${tidy(x + rx)} ${y}`,
    `H${tidy(x + width - rx)}`,
    `A${rx} ${ry} 0 0 1 ${tidy(x + width)} ${tidy(y + ry)}`,
    `V${tidy(y + height - ry)}`,
    `A${rx} ${ry} 0 0 1 ${tidy(x + width - rx)} ${tidy(y + height)}`,
    `H${tidy(x + rx)}`,
    `A${rx} ${ry} 0 0 1 ${x} ${tidy(y + height - ry)}`,
    `V${tidy(y + ry)}`,
    `A${rx} ${ry} 0 0 1 ${tidy(x + rx)} ${y}`,
    'Z',
  ].join('')
}

function ellipseToPath(cx: number, cy: number, rx: number, ry: number): string | null {
  if (rx <= 0 || ry <= 0) return null
  return `M${tidy(cx - rx)} ${cy}A${rx} ${ry} 0 1 0 ${tidy(cx + rx)} ${cy}A${rx} ${ry} 0 1 0 ${tidy(cx - rx)} ${cy}Z`
}

/**
 * Converts a basic shape or path into path data in its own coordinate system.
 * Returns null for degenerate shapes and non-shape elements.
 */
export function shapeToPath(element: Element): string | null {
  switch (element.localName) {
    case 'path':
      return element.getAttribute('d')?.trim() || null
    case 'rect':
      return rectToPath(element)
    case 'circle': {
      const r = numberAttr(element, 'r')
      return ellipseToPath(numberAttr(element, 'cx'), numberAttr(element, 'cy'), r, r)
    }
    case 'ellipse':
      return ellipseToPath(
        numberAttr(element, 'cx'),
        numberAttr(element, 'cy'),
        numberAttr(element, 'rx'),
        numberAttr(element, 'ry'),
      )
    case 'line':
      return `M${numberAttr(element, 'x1')} ${numberAttr(element, 'y1')}L${numberAttr(element, 'x2')} ${numberAttr(element, 'y2')}`
    case 'polyline':
      return pointsToPath(element.getAttribute('points') ?? '', false)
    case 'polygon':
      return pointsToPath(element.getAttribute('points') ?? '', true)
    default:
      return null
  }
}

export const SHAPE_ELEMENTS = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'])
