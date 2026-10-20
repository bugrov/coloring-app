import { describe, expect, it } from 'vitest'
import { parseColor, relativeLuminance, toHex } from '../../../../layers/coloring/shared/svg/color'

describe('parseColor', () => {
  it.each([
    ['#fff', '#ffffff'],
    ['#FFFF', '#ffffff'],
    ['#1E1E1E', '#1e1e1e'],
    ['#1e1e1e80', '#1e1e1e'],
    ['rgb(255, 0, 0)', '#ff0000'],
    ['rgba(0,0,255,0.5)', '#0000ff'],
    ['rgb(100%, 50%, 0%)', '#ff8000'],
    ['white', '#ffffff'],
    ['  Black ', '#000000'],
  ])('parses %s', (input, hex) => {
    const rgb = parseColor(input)

    expect(rgb && toHex(rgb)).toBe(hex)
  })

  it.each(['url(#gradient)', 'tomato', '#12', 'rgb(a, b, c)', ''])('rejects %s', (input) => {
    expect(parseColor(input)).toBeNull()
  })
})

describe('relativeLuminance', () => {
  it('spans from black to white', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0)
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1)
  })

  it('treats typical outline colours as dark and pastel fills as light', () => {
    expect(relativeLuminance(parseColor('#1e1e1e')!)).toBeLessThan(0.2)
    expect(relativeLuminance(parseColor('#ffd6e0')!)).toBeGreaterThan(0.5)
  })
})
