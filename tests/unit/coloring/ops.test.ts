import { describe, expect, it } from 'vitest'
import { opSchema } from '../../../layers/coloring/shared'

const stroke = { type: 'stroke', region: 1, width: 10, points: [0, 0, 5, 5] }

describe('opSchema', () => {
  it.each([
    ['pencil with a colour', { ...stroke, tool: 'pencil', color: '#e53935' }],
    ['eraser without a colour', { ...stroke, tool: 'eraser', color: null }],
    ['fill', { type: 'fill', region: 2, color: '#000000' }],
    ['clear', { type: 'clear', region: 2 }],
    ['brush at 50% opacity', { ...stroke, tool: 'brush', color: '#e53935', opacity: 50 }],
    ['fill at 25% opacity', { type: 'fill', region: 2, color: '#000000', opacity: 25 }],
    ['a stroke on the sheet around the art (before the art and past it)', { ...stroke, tool: 'pencil', color: '#e53935', points: [-300, -10, 5000, 4200] }],
  ])('accepts %s', (_name, op) => {
    expect(opSchema.safeParse(op).success).toBe(true)
  })

  it.each([
    ['brush without a colour', { ...stroke, tool: 'brush', color: null }],
    ['eraser with a colour', { ...stroke, tool: 'eraser', color: '#e53935' }],
    ['odd number of coordinates', { ...stroke, tool: 'pencil', color: '#e53935', points: [0, 0, 5] }],
    ['coordinates beyond the sheet', { ...stroke, tool: 'pencil', color: '#e53935', points: [0, 0, 10000, 5] }],
    ['colour in another format', { type: 'fill', region: 2, color: 'red' }],
    ['unknown type', { type: 'erase-all' }],
    ['eraser with opacity', { ...stroke, tool: 'eraser', color: null, opacity: 50 }],
    ['opacity above 100', { type: 'fill', region: 2, color: '#000000', opacity: 101 }],
    ['opacity below the faintest preset', { type: 'fill', region: 2, color: '#000000', opacity: 10 }],
    ['fractional opacity', { type: 'fill', region: 2, color: '#000000', opacity: 50.5 }],
  ])('rejects %s', (_name, op) => {
    expect(opSchema.safeParse(op).success).toBe(false)
  })
})
