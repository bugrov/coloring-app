import { describe, expect, it } from 'vitest'
import { ART_FORMAT_VERSION, artSchema, convertSvg } from '../../../../layers/coloring/shared'
import type { SvgConversion } from '../../../../layers/coloring/shared'

/**
 * Regression tests for the security review of the SVG pipeline: inputs that
 * used to burn CPU, blow up the output or leak attacker text.
 */

const SQUARE = '<rect x="10" y="10" width="50" height="50" fill="white" stroke="black"/>'
const svg = (body: string, attrs = 'viewBox="0 0 100 100"') => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`
const errorOf = (result: SvgConversion) => (result.ok ? null : result.error)

function timed(source: string): { result: SvgConversion, ms: number } {
  const started = performance.now()
  const result = convertSvg(source)
  return { result, ms: performance.now() - started }
}

describe('SVG hardening: CPU', () => {
  it('handles unbalanced CSS in linear time', () => {
    // Used to take ~6 s for 100 KB with a quadratic regex; now also over the CSS cap.
    const { result, ms } = timed(svg(`<style>${'a'.repeat(900_000)}</style>${SQUARE}`))

    expect(result.ok && result.warnings.map(w => w.code)).toContain('ignored-styles')
    expect(ms).toBeLessThan(500)
  })

  it('handles comment bombs below the CSS cap quickly', () => {
    const { result, ms } = timed(svg(`<style>${'/*'.repeat(30_000)}.a{fill:#fff}</style>${SQUARE}`))

    expect(result.ok).toBe(true)
    expect(ms).toBeLessThan(200)
  })

  it('skips nested blocks but keeps the class rule right after them', () => {
    const result = convertSvg(svg('<style>@media print{.a{fill:#000}}.light{fill:#fff}</style><rect class="light" width="10" height="10"/>'))

    expect(result.ok && result.art.items.filter(item => item.type === 'region' && item.kind === 'area')).toHaveLength(1)
  })

  it('still applies normal class rules after comments', () => {
    const result = convertSvg(svg('<style>/* x */ .light { fill: #fff } /* y */</style><rect class="light" width="10" height="10"/>'))

    expect(result.ok && result.art.items.filter(item => item.type === 'region' && item.kind === 'area')).toHaveLength(1)
  })

  it('parses huge malformed transforms in linear time', () => {
    // svgpath's regex took ~188 s on this input.
    const { result, ms } = timed(svg(`<rect width="10" height="10" fill="white" transform="${'skewX('.repeat(160_000)}"/>${SQUARE}`))

    expect(result.ok && result.warnings.map(w => w.code)).toContain('invalid-transform')
    expect(ms).toBeLessThan(500)
  })

  it('parses implicit command repetition in linear time', () => {
    // svgpath expands implicit repetition quadratically: ~36 s for this polygon.
    const points = '1 1 2 2 '.repeat(24_000)
    const { result, ms } = timed(svg(`<polygon points="${points}" fill="white"/><path d="M0 0L${'1 1 '.repeat(24_000)}" fill="white"/>${SQUARE}`))

    expect(result.ok).toBe(true)
    expect(ms).toBeLessThan(1000)
  })

  it('rejects deep nesting with a clear error instead of overflowing the stack', () => {
    const depth = 1000
    expect(errorOf(convertSvg(svg(`${'<g>'.repeat(depth)}${SQUARE}${'</g>'.repeat(depth)}`)))).toBe('too-complex')
  })
})

describe('SVG hardening: output size', () => {
  it('rejects <use> fan-out that multiplies a tiny file into a huge result', () => {
    // 5 levels × 5 references to the level below = 3125 copies of one stroke.
    let defs = '<path id="l0" d="M0 0L10 10" stroke="#000" fill="none"/>'
    for (let level = 1; level <= 5; level++) {
      defs += `<g id="l${level}">${`<use href="#l${level - 1}"/>`.repeat(5)}</g>`
    }

    expect(errorOf(convertSvg(svg(`<defs>${defs}</defs><use href="#l5"/>${SQUARE}`)))).toBe('too-complex')
  })
})

describe('SVG hardening: legitimate re-use', () => {
  it('accepts symbol sheets that place one symbol many times', () => {
    // 300 placements of a symbol nested 40 groups deep: ~12 000 visits, but only 300 regions.
    const tile = `${'<g>'.repeat(40)}<rect width="10" height="10" fill="white"/>${'</g>'.repeat(40)}`
    const uses = Array.from({ length: 300 }, (_, i) => `<use href="#tile" x="${(i % 20) * 15}" y="${Math.floor(i / 20) * 15}"/>`).join('')
    const result = convertSvg(svg(`<defs><symbol id="tile">${tile}</symbol></defs>${uses}`, 'viewBox="0 0 300 225"'))

    expect(result.ok && result.art.items.filter(item => item.type === 'region' && item.kind === 'area')).toHaveLength(300)
  })
})

describe('SVG hardening: degenerate input', () => {
  it.each([
    ['tiny', 'viewBox="0 0 1e-300 1e-300"'],
    ['huge', 'viewBox="0 0 1e300 1e300"'],
    ['extremely elongated', 'viewBox="0 0 10000 1"'],
  ])('rejects a %s viewBox', (_name, attrs) => {
    expect(errorOf(convertSvg(svg(SQUARE, attrs)))).toBe('invalid-dimensions')
  })

  it('drops shapes that collapse to nothing under extreme transforms', () => {
    const result = convertSvg(svg(`<rect width="10" height="10" fill="white" transform="scale(1e308)"/><rect width="10" height="0.000001" fill="white"/>${SQUARE}`))

    expect(result.ok && result.art.items.filter(item => item.type === 'region' && item.kind === 'area')).toHaveLength(1)
  })

  it('clamps out-of-range numbers instead of failing the whole import', () => {
    const result = convertSvg(svg('<rect width="10" height="10" fill="white" stroke="black" stroke-miterlimit="1e999" stroke-width="1e999"/>'))

    expect(result.ok).toBe(true)
  })
})

describe('SVG hardening: attacker text', () => {
  it('strips markup characters from warning details', () => {
    const result = convertSvg(svg(`<use href="<img src=x onerror=alert(1)>"/><rect width="10" height="10" fill="url(&quot;&lt;script&gt;)"/>${SQUARE}`))
    const details = result.ok ? result.warnings.map(w => w.detail ?? '').join(' ') : ''

    expect(details).not.toMatch(/[<>"'\s=]/)
  })

  it('does not resolve prototype keys as colour names', () => {
    const result = convertSvg(svg('<rect width="10" height="10" fill="constructor"/><rect width="10" height="10" fill="__proto__"/>'))

    // Unknown names are reported as unsupported paint, never treated as colours.
    expect(result.ok && result.warnings.every(w => w.code === 'unsupported-paint')).toBe(true)
  })
})

describe('SVG hardening: art format', () => {
  it('rounds region bounds outwards so they still contain the shape', () => {
    const result = convertSvg(svg('<rect x="10.123" y="10.127" width="20.001" height="20.003" fill="white"/>'))
    const area = result.ok ? result.art.items.find(item => item.type === 'region' && item.kind === 'area') : undefined

    if (area?.type !== 'region') throw new Error('Expected an area')
    // The stored path is rounded to 10.12,10.13 – 30.12,30.13; bounds must contain it.
    const [minX, minY, maxX, maxY] = area.bounds
    expect(minX).toBeLessThanOrEqual(10.12)
    expect(minY).toBeLessThanOrEqual(10.13)
    expect(maxX).toBeGreaterThanOrEqual(30.12)
    expect(maxY).toBeGreaterThanOrEqual(30.13)
    expect(area.bounds.every(value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6)).toBe(true)
  })

  it('accepts many small decimal shapes without float artefacts inflating them', () => {
    const rects = Array.from({ length: 400 }, (_, i) => `<rect x="${(i % 20) * 0.3 + 0.1}" y="${Math.floor(i / 20) * 0.3 + 0.1}" width="0.2" height="0.2" rx="0.1" fill="white"/>`).join('')

    expect(convertSvg(svg(rects, 'viewBox="0 0 6 6"')).ok).toBe(true)
  })

  it('rejects stored arts with unordered bounds', () => {
    const art = {
      version: ART_FORMAT_VERSION,
      viewBox: [0, 0, 10, 10],
      items: [{ type: 'region', id: 1, kind: 'area', d: 'M0 0H5V5H0Z', fillRule: 'nonzero', bounds: [5, 5, 0, 0] }],
    }

    expect(artSchema.safeParse(art).success).toBe(false)
  })
})
