import { describe, expect, it } from 'vitest'
import { analyzePath, applyTransforms, transformScale } from '../../../../layers/coloring/shared/svg/geometry'

describe('analyzePath', () => {
  it.each([
    ['explicit close', 'M0 0L10 0L10 10Z', true],
    ['returns to start without Z', 'M0 0L10 0L10 10L0 0', true],
    ['open polyline', 'M0 0L10 0L10 10', false],
    ['every subpath closed', 'M0 0H10V10Z M20 20H30V30Z', true],
    ['one subpath open', 'M0 0H10V10Z M20 20H30', false],
    ['relative commands', 'm0 0 h10 v10 h-10 z', true],
  ])('%s', (_name, d, closed) => {
    expect(analyzePath(d).closed).toBe(closed)
  })

  it('reports bounds', () => {
    expect(analyzePath('M5 10H25V40H5Z').bounds).toEqual({ minX: 5, minY: 10, maxX: 25, maxY: 40 })
  })
})

describe('transforms', () => {
  it('applies the element transform before its ancestors', () => {
    // translate(10) then scale(2) of the parent: x' = 2 * (x + 10)
    expect(applyTransforms('M0 0H1', ['scale(2)', 'translate(10 0)'])).toBe('M20 0H22')
  })

  it('measures the average scale for stroke widths', () => {
    expect(transformScale([])).toBe(1)
    expect(transformScale(['scale(2)', 'rotate(30)'])).toBeCloseTo(2)
    expect(transformScale(['scale(4 1)'])).toBeCloseTo(2)
  })
})
