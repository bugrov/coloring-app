import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { convertSvg } from '../../../../layers/coloring/shared/svg/pipeline'

const BASE_ARTS = ['cat', 'house'] as const

describe.each(BASE_ARTS)('base art: %s', (name) => {
  const source = readFileSync(new URL(`../../../../layers/coloring/server/assets/arts/${name}.svg`, import.meta.url), 'utf8')
  const result = convertSvg(source)

  it('converts cleanly', () => {
    expect(result.ok && result.warnings).toEqual([])
  })

  it('has a background and a meaningful number of areas', () => {
    if (!result.ok) throw new Error(result.error)
    const regions = result.art.items.filter(item => item.type === 'region')

    expect(regions[0]?.kind).toBe('background')
    expect(regions.filter(region => region.kind === 'area').length).toBeGreaterThanOrEqual(15)
  })
})
