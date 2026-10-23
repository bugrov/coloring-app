import { describe, expect, it } from 'vitest'
import type { ArtItem, ArtRegion, SvgConversion } from '../../../../layers/coloring/shared'
import { convertSvg, DEFAULT_SVG_LIMITS } from '../../../../layers/coloring/shared'

const svg = (body: string, attrs = 'viewBox="0 0 100 100"') => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`

/** A frame of black fill: the area inside it is white, but no shape says so. */
const FRAME = '<path d="M10 10H90V90H10Z M20 20H80V80H20Z" fill="#000" fill-rule="evenodd"/>'

const areas = (items: ArtItem[]) => items.filter((item): item is ArtRegion => item.type === 'region' && item.kind === 'area')
const errorOf = (result: SvgConversion) => (result.ok ? null : result.error)

function areasOf(source: string): ArtRegion[] {
  const result = convertSvg(source)

  if (!result.ok) throw new Error(`Expected success, got ${result.error}`)

  return areas(result.art.items)
}

describe('areas between the lines of a drawing that has only dark shapes', () => {
  it('finds the white inside an outline, grown a little so that it goes under the line', () => {
    const [area, ...others] = areasOf(svg(FRAME))

    expect(others).toEqual([])
    expect(area!.bounds[0]).toBeGreaterThanOrEqual(10)
    expect(area!.bounds[0]).toBeLessThanOrEqual(20)
    expect(area!.bounds[2]).toBeGreaterThanOrEqual(80)
    expect(area!.bounds[2]).toBeLessThanOrEqual(90)
  })

  it('finds every enclosed part, the outside is the background', () => {
    const body = `${FRAME}<path d="M30 30H70V70H30Z M40 40H60V60H40Z" fill="#000" fill-rule="evenodd"/>`
    const found = areasOf(svg(body))

    // The ring between the frame and the inner outline, and the inside of the inner one.
    expect(found).toHaveLength(2)
  })

  it('finds an area drawn by separate strokes that meet', () => {
    const edge = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width="4"/>`
    const body = edge(10, 10, 90, 10) + edge(90, 10, 90, 90) + edge(90, 90, 10, 90) + edge(10, 90, 10, 10)

    expect(areasOf(svg(body))).toHaveLength(1)
  })

  it('closes a hairline gap in the outline', () => {
    // The right bar stops 0.1 short of the top one: about one pixel of the bitmap.
    const body = [
      '<rect x="10" y="10" width="80" height="10" fill="#000"/>',
      '<rect x="10" y="80" width="80" height="10" fill="#000"/>',
      '<rect x="10" y="20" width="10" height="60" fill="#000"/>',
      '<rect x="80" y="20.1" width="10" height="59.8" fill="#000"/>',
    ].join('')

    expect(areasOf(svg(body))).toHaveLength(1)
  })

  it('finds nothing in a drawing whose outline is open: its white is the outside', () => {
    const body = [
      '<rect x="10" y="10" width="80" height="10" fill="#000"/>',
      '<rect x="10" y="80" width="80" height="10" fill="#000"/>',
      '<rect x="10" y="20" width="10" height="60" fill="#000"/>',
      '<rect x="80" y="20" width="10" height="20" fill="#000"/>',
    ].join('')

    expect(errorOf(convertSvg(svg(body)))).toBe('no-regions')
  })

  it('leaves out specks that are not worth a colour', () => {
    const body = `${FRAME}<path d="M50 50h0.4v0.4h-0.4Z" fill="#fff"/><circle cx="50" cy="50" r="0.1" fill="#000"/>`

    expect(areasOf(svg(body)).length).toBeLessThanOrEqual(2)
  })

  it('does not look for areas when the file has some of its own', () => {
    const body = '<rect x="10" y="10" width="50" height="50" fill="#fff" stroke="#000"/><path d="M60 60H90V90H60Z M65 65H85V85H65Z" fill="#000" fill-rule="evenodd"/>'

    expect(areasOf(svg(body))).toHaveLength(1)
  })

  it('stays within the size the result may have: the largest areas are kept, the rest left out', () => {
    // Twenty rings in a grid.
    const rings = Array.from({ length: 20 }, (_, index) => {
      const x = 5 + (index % 5) * 19
      const y = 5 + Math.floor(index / 5) * 19

      return `<path d="M${x} ${y}h15v15h-15Z M${x + 3} ${y + 3}h9v9h-9Z" fill="#000" fill-rule="evenodd"/>`
    }).join('')
    const source = svg(rings)
    const all = convertSvg(source)
    const limited = convertSvg(source, { ...DEFAULT_SVG_LIMITS, maxOutputLength: 4000 })

    expect(all.ok && areas(all.art.items)).toHaveLength(20)
    expect(limited.ok).toBe(true)
    expect(limited.ok && areas(limited.art.items).length).toBeLessThan(20)
    expect(limited.ok && JSON.stringify(limited.art).length).toBeLessThanOrEqual(4000)
  })

  it('takes a big dark outline that spans the whole drawing for the drawing, not for a frame fill', () => {
    // Its bounds are the whole canvas, but it has curves: a frame fill is a plain rectangle.
    const outline = '<path d="M0 0H100V100H0Z M8 50C8 20 30 8 50 8C70 8 92 20 92 50C92 80 70 92 50 92C30 92 8 80 8 50Z" fill="#000" fill-rule="evenodd"/>'
    const result = convertSvg(svg(outline))

    expect(result.ok && result.art.items.filter(item => item.type === 'ink')).toHaveLength(1)
    expect(result.ok && areas(result.art.items)).toHaveLength(1)
  })

  it('keeps a lone open line a mistake: nothing to colour', () => {
    expect(errorOf(convertSvg(svg('<path d="M10 10L90 90" stroke="#000" stroke-width="3" fill="none"/>')))).toBe('no-regions')
  })
})

describe('the document type of a drawing', () => {
  const plain = '<?xml version="1.0" standalone="no"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n'

  it('accepts the plain one that design and trace tools write, and reads the drawing as usual', () => {
    expect(areasOf(plain + svg(FRAME))).toHaveLength(1)
  })

  it('accepts a quoted address that holds a ">"', () => {
    expect(areasOf(`<!DOCTYPE svg PUBLIC "a>b" "c">${svg(FRAME)}`)).toHaveLength(1)
  })

  it('refuses a document type with declarations inside', () => {
    expect(errorOf(convertSvg(`<!DOCTYPE svg [ <!ELEMENT svg ANY> ]>${svg(FRAME)}`))).toBe('doctype-not-allowed')
    expect(errorOf(convertSvg(`<!DOCTYPE svg [<!ENTITY a "b">]>${svg(FRAME)}`))).toBe('doctype-not-allowed')
  })

  it('refuses an entity wherever it is', () => {
    expect(errorOf(convertSvg(`${plain}<!-- <!ENTITY a "b"> -->${svg(FRAME)}`))).toBe('doctype-not-allowed')
  })

  it('refuses a second one', () => {
    expect(errorOf(convertSvg(`${plain}<!DOCTYPE svg>${svg(FRAME)}`))).toBe('doctype-not-allowed')
  })

  it('does not take a document type that is never closed for a drawing', () => {
    // It swallows the start of the drawing, and what is left is not a document.
    expect(errorOf(convertSvg(`<!DOCTYPE svg PUBLIC "x" ${svg(FRAME)}`))).not.toBeNull()
    expect(errorOf(convertSvg('<!DOCTYPE svg PUBLIC "x"'))).toBe('doctype-not-allowed')
  })
})
