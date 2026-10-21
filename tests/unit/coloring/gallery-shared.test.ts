import { describe, expect, it } from 'vitest'
import { artToSvg } from '../../../layers/coloring/shared/art'
import { ART_TITLE_MAX_LENGTH, DEFAULT_IMPORT_TITLE, galleryQuerySchema, titleFromFileName } from '../../../layers/coloring/shared/gallery'
import { convertSvg } from '../../../layers/coloring/shared/svg'

describe('titleFromFileName', () => {
  it.each([
    ['cat.svg', 'cat'],
    ['C:\\Users\\me\\Мой кот.SVG', 'Мой кот'],
    ['../../etc/passwd.svg', 'passwd'],
    ['  a \t\n b  .svg', 'a b'],
  ])('turns %j into %j', (input, expected) => {
    expect(titleFromFileName(input)).toBe(expected)
  })

  it('falls back when nothing usable is left', () => {
    expect(titleFromFileName(undefined)).toBe(DEFAULT_IMPORT_TITLE)
    expect(titleFromFileName('.svg')).toBe(DEFAULT_IMPORT_TITLE)
    expect(titleFromFileName('\u0000\u0001')).toBe(DEFAULT_IMPORT_TITLE)
  })

  it('cuts a long name by characters, not code units', () => {
    const title = titleFromFileName(`${'😀'.repeat(ART_TITLE_MAX_LENGTH + 10)}.svg`)

    expect(Array.from(title)).toHaveLength(ART_TITLE_MAX_LENGTH)
  })
})

describe('galleryQuerySchema', () => {
  it.each(['1', '42', '9007199254740'])('accepts the cursor %s', (cursor) => {
    expect(galleryQuerySchema.safeParse({ cursor }).success).toBe(true)
  })

  it.each(['0', '-1', '1.5', '1e3', 'abc', '', '12345678901234567', '1 OR 1=1'])('rejects the cursor %j', (cursor) => {
    expect(galleryQuerySchema.safeParse({ cursor }).success).toBe(false)
  })

  it('allows no cursor for the first page', () => {
    expect(galleryQuerySchema.safeParse({}).success).toBe(true)
  })
})

describe('artToSvg', () => {
  const source = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="#fff"/><path d="M1 1L9 9" stroke="#000" fill="none"/></svg>'
  const converted = convertSvg(source)

  it('builds a standalone document from the normalized art only', () => {
    if (!converted.ok) throw new Error('fixture must convert')
    const svg = artToSvg(converted.art)

    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">')).toBe(true)
    expect(svg).toContain('fill="#fff"')
    expect(svg).toContain('stroke="#000000"')
    expect(svg.endsWith('</svg>')).toBe(true)
  })

  it('drops a tampered path or colour instead of writing it out', () => {
    if (!converted.ok) throw new Error('fixture must convert')
    const art = structuredClone(converted.art)
    for (const item of art.items) {
      item.d = 'M0 0"/><script>alert(1)</script>'
      if (item.type === 'ink') item.stroke = 'red" onload="x'
    }
    const svg = artToSvg(art)

    expect(svg).not.toContain('script')
    expect(svg).not.toContain('onload')
  })
})
