import { describe, expect, it } from 'vitest'
import { PALETTE_SIZE, paletteSchema, settingsSchema } from '../../../layers/coloring/shared/admin'
import { PALETTE } from '../../../layers/coloring/shared/palette'

const valid = () => PALETTE.map(color => ({ ...color }))

describe('paletteSchema', () => {
  it('takes the standard palette', () => {
    expect(PALETTE).toHaveLength(PALETTE_SIZE)
    expect(paletteSchema.safeParse(valid()).success).toBe(true)
  })

  it('needs exactly the panel size', () => {
    expect(paletteSchema.safeParse(valid().slice(1)).success).toBe(false)
    expect(paletteSchema.safeParse([...valid(), { hex: '#010203', name: 'Лишний' }]).success).toBe(false)
  })

  it.each(['red', '#FFF', '#12345', '#GGGGGG', '#AABBCC', 'javascript:alert(1)', ''])('refuses %s as a colour', (hex) => {
    const palette = valid()

    palette[0] = { hex, name: 'Цвет' }
    expect(paletteSchema.safeParse(palette).success).toBe(false)
  })

  it('refuses a colour twice, an empty name and a long one', () => {
    const twice = valid()

    twice[1] = { ...twice[0]! }
    expect(paletteSchema.safeParse(twice).success).toBe(false)

    const empty = valid()

    empty[0] = { hex: '#010203', name: '   ' }
    expect(paletteSchema.safeParse(empty).success).toBe(false)

    const long = valid()

    long[0] = { hex: '#010203', name: 'я'.repeat(31) }
    expect(paletteSchema.safeParse(long).success).toBe(false)
  })
})

describe('settingsSchema', () => {
  it.each([0.5, 0.95, 1])('takes %s', (value) => {
    expect(settingsSchema.safeParse({ paintedTolerance: value }).success).toBe(true)
  })

  it.each([0.49, 1.01, -1, Number.NaN, '0.9'])('refuses %s', (value) => {
    expect(settingsSchema.safeParse({ paintedTolerance: value }).success).toBe(false)
  })
})
