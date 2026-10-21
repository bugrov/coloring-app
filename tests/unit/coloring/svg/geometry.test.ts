import { describe, expect, it } from 'vitest'
import { processPath } from '../../../../layers/coloring/shared/svg/geometry'
import { explicitPathData } from '../../../../layers/coloring/shared/svg/path-data'
import { IDENTITY, matrixScale, multiply, parseTransform } from '../../../../layers/coloring/shared/svg/transform'

describe('explicitPathData', () => {
  it.each([
    ['implicit line-tos after a move', 'M0 0 10 0 10 10', 'M0 0L10 0L10 10'],
    ['relative move continues as relative lines', 'm1 1 2 2', 'm1 1l2 2'],
    ['repeated commands', 'M0 0L1 1 2 2', 'M0 0L1 1L2 2'],
    ['compact numbers', 'M0,0L1-11-1.5.5', 'M0 0L1 -11L-1.5 .5'],
    ['compact arc flags', 'M0 0a1,1,0,01,1,1', 'M0 0a1 1 0 0 1 1 1'],
    ['close then new command', 'M0 0L1 1ZM2 2L3 3Z', 'M0 0L1 1ZM2 2L3 3Z'],
  ])('%s', (_name, input, expected) => {
    expect(explicitPathData(input)).toBe(expected)
  })

  it.each([
    ['numbers after Z', 'M0 0L1 1Z 5 5', 'M0 0L1 1Z'],
    ['missing parameters', 'M0 0L5 5L1', 'M0 0L5 5'],
    ['bad arc flag', 'M0 0L5 5a1 1 0 2 1 1 1', 'M0 0L5 5'],
    ['garbage', 'M0 0L5 5 javascript:alert(1)', 'M0 0L5 5'],
  ])('keeps the valid part before an error, as browsers do: %s', (_name, input, expected) => {
    expect(explicitPathData(input)).toBe(expected)
  })

  it.each([
    ['not starting with a move', 'L1 1'],
    ['an error before anything valid', 'Mx'],
    ['empty', ''],
  ])('rejects %s', (_name, input) => {
    expect(explicitPathData(input)).toBeNull()
  })
})

describe('parseTransform', () => {
  it('composes a chain left to right', () => {
    // translate then scale: x' = 2x + 10
    expect(parseTransform('translate(10) scale(2)')).toEqual([2, 0, 0, 2, 10, 0])
  })

  it('accepts commas and the matrix form', () => {
    expect(parseTransform('matrix(1,0,0,1,5,6)')).toEqual([1, 0, 0, 1, 5, 6])
  })

  it('accepts numbers without separators, as browsers do', () => {
    expect(parseTransform('translate(1-2)')).toEqual([1, 0, 0, 1, 1, -2])
  })

  it.each([
    'skewX(skewX(skewX(',
    'rotate(abc)',
    'constructor(1)',
    'scale(1 2 3)',
    'translate(1e999)',
    'translate(1,)',
    'scale(1e)',
    'translate(1,,2)',
  ])('rejects %s', (input) => {
    expect(parseTransform(input)).toBeNull()
  })

  it('scales stroke widths by the average linear scale', () => {
    expect(matrixScale(IDENTITY)).toBe(1)
    expect(matrixScale(parseTransform('scale(2) rotate(30)')!)).toBeCloseTo(2)
    expect(matrixScale(parseTransform('scale(4 1)')!)).toBeCloseTo(2)
  })

  it('applies the inner transform first when composing', () => {
    // parent scale(2) around child translate(10): x' = 2 * (x + 10)
    expect(multiply(parseTransform('scale(2)')!, parseTransform('translate(10 0)')!)).toEqual([2, 0, 0, 2, 20, 0])
  })
})

describe('processPath', () => {
  it('transforms, rounds and keeps explicit commands', () => {
    const result = processPath('M0 0 1 0', parseTransform('scale(2) translate(10 0)')!, 2)

    expect(result?.d).toBe('M20 0L22 0')
  })

  it.each([
    ['explicit close', 'M0 0L10 0L10 10Z', true],
    ['returns to start without Z', 'M0 0L10 0L10 10L0 0', true],
    ['open polyline', 'M0 0L10 0L10 10', false],
    ['every subpath closed', 'M0 0H10V10Z M20 20H30V30Z', true],
    ['one subpath open', 'M0 0H10V10Z M20 20H30', false],
    ['relative commands', 'm0 0 h10 v10 h-10 z', true],
  ])('detects closed paths: %s', (_name, d, closed) => {
    expect(processPath(d, IDENTITY, 2)?.closed).toBe(closed)
  })

  it('measures bounds including the bulge of arcs', () => {
    const { bounds } = processPath('M40 50A10 10 0 1 0 60 50A10 10 0 1 0 40 50Z', IDENTITY, 2)!

    expect(bounds!.minY).toBeLessThanOrEqual(40)
    expect(bounds!.maxY).toBeGreaterThanOrEqual(60)
  })

  it('returns null for malformed data', () => {
    expect(processPath('Mx', IDENTITY, 2)).toBeNull()
  })
})
