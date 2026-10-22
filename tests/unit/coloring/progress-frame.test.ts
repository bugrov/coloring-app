import { describe, expect, it } from 'vitest'
import { PROGRESS_FRAME_START_ANGLE, progressDashOffset, progressFramePath } from '../../../layers/coloring/app/utils/progress-frame'

describe('progressFramePath', () => {
  it('starts in the middle of the left edge (180 degrees) and goes up first', () => {
    const path = progressFramePath(257, 200, 8, 56)

    expect(PROGRESS_FRAME_START_ANGLE).toBe(180)
    expect(path.startsWith('M8 100V64')).toBe(true)
  })

  it('runs clockwise: every corner arc has sweep flag 1', () => {
    const arcs = progressFramePath(257, 200, 8, 56).match(/A[^AHV]*/g) ?? []

    expect(arcs).toHaveLength(4)

    for (const arc of arcs) expect(arc).toMatch(/^A\d+ \d+ 0 0 1 /)
  })

  it('ends where it started, so 100% closes the ring', () => {
    expect(progressFramePath(181, 200, 8, 56).endsWith('V100')).toBe(true)
  })

  it('shrinks the corner radius when the box is too small for it', () => {
    const path = progressFramePath(40, 40, 8, 56)

    expect(path).toContain('A12 12 0 0 1')
  })
})

describe('progressDashOffset', () => {
  it.each([
    [0, 1],
    [25, 0.75],
    [100, 0],
    [-5, 1],
    [140, 0],
  ])('maps %i%% to the offset %f', (percent, offset) => {
    expect(progressDashOffset(percent)).toBeCloseTo(offset)
  })
})
