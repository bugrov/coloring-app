import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ArtInk, ArtItem, ArtRegion, ColoringArt, SvgConversion } from '../../../../layers/coloring/shared'
import { convertSvg, DEFAULT_SVG_LIMITS } from '../../../../layers/coloring/shared'

const fixture = (name: string) => readFileSync(new URL(`../../../fixtures/svg/${name}`, import.meta.url), 'utf8')

const svg = (body: string, attrs = 'viewBox="0 0 100 100"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ${attrs}>${body}</svg>`

/** A white square with a black outline: the simplest valid colouring page. */
const SQUARE = '<rect x="10" y="10" width="50" height="50" fill="white" stroke="black"/>'

function convertOk(source: string): { art: ColoringArt, warnings: string[] } {
  const result = convertSvg(source)
  if (!result.ok) throw new Error(`Expected success, got ${result.error}`)
  return { art: result.art, warnings: result.warnings.map(w => w.code) }
}

const regions = (items: ArtItem[]) => items.filter((item): item is ArtRegion => item.type === 'region')
const areas = (items: ArtItem[]) => regions(items).filter(region => region.kind === 'area')
const inks = (items: ArtItem[]) => items.filter((item): item is ArtInk => item.type === 'ink')
const errorOf = (result: SvgConversion) => (result.ok ? null : result.error)

describe('convertSvg: Figma exports', () => {
  it('turns basic shapes into regions with outlines, keeping the frame fill as background', () => {
    const { art, warnings } = convertOk(fixture('figma-shapes.svg'))

    expect(art.viewBox).toEqual([0, 0, 400, 300])
    expect(regions(art.items).map(r => r.kind)).toEqual(['background', 'area', 'area', 'area', 'area'])
    expect(inks(art.items)).toHaveLength(4)
    expect(inks(art.items).every(ink => ink.fill === null && ink.stroke !== null)).toBe(true)
    expect(warnings).toEqual([])
  })

  it('ignores the frame clip-path definition', () => {
    const { art } = convertOk(fixture('figma-shapes.svg'))

    // The clipPath rect inside <defs> must not become a second background.
    expect(regions(art.items).filter(r => r.kind === 'background')).toHaveLength(1)
  })

  it('handles pen paths: closed outlines become regions, open strokes and dark fills stay ink', () => {
    const { art } = convertOk(fixture('figma-pen.svg'))
    const [background, ...rest] = art.items

    // No frame fill in this export: a background is synthesised from the viewBox.
    expect(background).toMatchObject({ type: 'region', kind: 'background', d: 'M0 0H200V200H0Z' })
    expect(rest.map(item => item.type)).toEqual(['region', 'ink', 'ink', 'ink', 'region', 'ink'])

    const ring = inks(art.items).find(ink => ink.fill === '#000000')
    expect(ring?.fillRule).toBe('evenodd')

    const whisker = inks(art.items).find(ink => ink.lineCap === 'round')
    expect(whisker).toMatchObject({ fill: null, stroke: '#000000', strokeWidth: 2 })
  })

  it('bakes group transforms into coordinates and scales stroke widths', () => {
    const { art } = convertOk(fixture('figma-pen.svg'))
    const scaledRect = areas(art.items).at(-1)!
    const scaledOutline = inks(art.items).at(-1)!

    expect(scaledRect.d).toBe('M10 150H50V170H10Z')
    expect(scaledOutline.strokeWidth).toBe(2)
  })

  it('numbers regions sequentially in document order', () => {
    const { art } = convertOk(fixture('figma-shapes.svg'))

    expect(regions(art.items).map(r => r.id)).toEqual([1, 2, 3, 4, 5])
  })
})

describe('convertSvg: classification', () => {
  it('keeps z-order: a white shape above a dark one stays a region', () => {
    const { art } = convertOk(svg(
      '<circle cx="50" cy="50" r="40" fill="#111"/><circle cx="50" cy="50" r="10" fill="white"/>',
    ))

    expect(art.items.slice(1).map(item => item.type)).toEqual(['ink', 'region'])
  })

  it('treats pastel and saturated fills as regions', () => {
    const { art } = convertOk(svg('<rect width="10" height="10" fill="#ffd6e0"/><rect x="20" width="10" height="10" fill="red"/>'))

    expect(areas(art.items)).toHaveLength(2)
  })

  it('follows SVG defaults: no fill attribute means black', () => {
    const result = convertSvg(svg('<rect width="10" height="10"/>'))

    expect(errorOf(result)).toBe('no-regions')
  })

  it('treats a dark full-canvas rect as the background, not as ink over everything', () => {
    const { art } = convertOk(svg(`<rect width="100" height="100" fill="#000"/>${SQUARE}`))

    expect(art.items[0]).toMatchObject({ type: 'region', kind: 'background' })
    expect(inks(art.items).some(ink => ink.fill !== null)).toBe(false)
  })

  it('resolves inherited, class and inline styles in priority order', () => {
    const { art } = convertOk(svg(
      '<style>.light{fill:#fff;stroke:#000;stroke-width:3px}</style>'
      + '<g fill="black"><rect class="light" width="10" height="10" style="stroke-width:5"/></g>',
    ))

    expect(areas(art.items)).toHaveLength(1)
    expect(inks(art.items)[0]).toMatchObject({ stroke: '#000000', strokeWidth: 5 })
  })

  it('skips hidden content', () => {
    const result = convertSvg(svg(
      '<rect width="10" height="10" fill="white" display="none"/>'
      + '<g opacity="0"><rect width="10" height="10" fill="white"/></g>'
      + '<rect width="10" height="10" fill="white" style="visibility:hidden"/>',
    ))

    expect(errorOf(result)).toBe('no-regions')
  })

  it('expands local <use> references with their offset', () => {
    const { art } = convertOk(svg(
      '<defs><path id="cell" d="M0 0H10V10H0Z"/></defs>'
      + '<use href="#cell" x="5" fill="white"/><use xlink:href="#cell" y="20" fill="white"/>',
    ))

    expect(areas(art.items).map(area => area.d)).toEqual(['M5 0H15V10H5Z', 'M0 20H10V30H0Z'])
  })

  it('stops on recursive <use> references', () => {
    const { art } = convertOk(svg(`<g id="loop"><use href="#loop"/></g>${SQUARE}`))

    expect(areas(art.items).length).toBeLessThanOrEqual(10)
  })

  it('replaces gradients with a plain region and warns', () => {
    const { art, warnings } = convertOk(svg(
      '<defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient></defs>'
      + '<rect width="10" height="10" fill="url(#g)"/>',
    ))

    expect(areas(art.items)).toHaveLength(1)
    expect(warnings).toContain('unsupported-paint')
  })
})

describe('convertSvg: security', () => {
  it('rejects entity expansion bombs', () => {
    const bomb = `<?xml version="1.0"?>
<!DOCTYPE svg [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">]>
${svg(`<text>&b;</text>${SQUARE}`)}`

    expect(errorOf(convertSvg(bomb))).toBe('doctype-not-allowed')
  })

  it('rejects external entities (XXE)', () => {
    const xxe = `<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>${svg(`<text>&xxe;</text>${SQUARE}`)}`

    expect(errorOf(convertSvg(xxe))).toBe('doctype-not-allowed')
  })

  it('drops scripts, event handlers, foreign content and external references', () => {
    const hostile = svg(
      '<script>alert(1)</script>'
      + '<foreignObject><iframe xmlns="http://www.w3.org/1999/xhtml" src="https://evil.example"/></foreignObject>'
      + '<image href="https://evil.example/x.png" width="10" height="10"/>'
      + '<use href="https://evil.example/sprite.svg#icon"/>'
      + `<a href="javascript:alert(1)">${SQUARE.replace('<rect', '<rect onclick="alert(1)"')}</a>`,
      'viewBox="0 0 100 100" onload="alert(1)"',
    )
    const { art, warnings } = convertOk(hostile)
    const serialized = JSON.stringify(art)

    expect(serialized).not.toMatch(/alert|evil|javascript|script|href/i)
    expect(areas(art.items)).toHaveLength(1)
    expect(warnings).toEqual(expect.arrayContaining(['unsupported-element', 'external-reference']))
  })

  it('drops path data that is not path data', () => {
    const result = convertSvg(svg('<path d="javascript:alert(1)" fill="white"/>'))

    expect(errorOf(result)).toBe('no-regions')
  })
})

describe('convertSvg: invalid input and limits', () => {
  it.each([
    ['empty input', ''],
    ['unclosed tags', '<svg viewBox="0 0 10 10"><rect></svg>'],
    ['plain text', 'hello'],
  ])('reports %s as malformed', (_name, source) => {
    expect(errorOf(convertSvg(source))).toBe('malformed')
  })

  it('rejects documents that are not SVG', () => {
    expect(errorOf(convertSvg('<html><body/></html>'))).toBe('not-svg')
  })

  it('requires dimensions', () => {
    expect(errorOf(convertSvg(svg(SQUARE, '')))).toBe('no-dimensions')
  })

  it('falls back to width and height when there is no viewBox', () => {
    const { art } = convertOk(svg(SQUARE, 'width="120px" height="80"'))

    expect(art.viewBox).toEqual([0, 0, 120, 80])
  })

  it('reports drawings without closed shapes', () => {
    expect(errorOf(convertSvg(svg('<path d="M0 0L10 10" stroke="black"/><text>Hi</text>')))).toBe('no-regions')
  })

  it.each([
    ['too-large', { maxBytes: 100 }],
    ['too-many-elements', { maxElements: 2 }],
    ['too-many-regions', { maxRegions: 1 }],
    ['timeout', { timeBudgetMs: -1 }],
  ] as const)('enforces %s', (error, limits) => {
    const source = svg(SQUARE + SQUARE.replace('x="10"', 'x="70"'))

    expect(errorOf(convertSvg(source, { ...DEFAULT_SVG_LIMITS, ...limits }))).toBe(error)
  })
})
