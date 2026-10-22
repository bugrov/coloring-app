import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import IndexPage from '~~/layers/core/app/pages/index.vue'

describe('game registry', () => {
  it('collects games contributed by game layers', () => {
    const games = useGames()

    expect(games.value.map(game => game.id)).toContain('coloring')
  })

  it('renders a link to every registered game on the hub page', async () => {
    const page = await mountSuspended(IndexPage)

    expect(page.find('a[href="/coloring"] h2').text()).toBe('Раскраска')
  })
})
