import { describe, expect, it } from 'vitest'
import type { GameDefinition } from '../../../shared/types/game'
import { listGames } from '../../../shared/utils/games'

const game = (id: string, order: number): GameDefinition => ({ id, title: id, entry: `/${id}`, order })

describe('listGames', () => {
  it('returns an empty list when no games are registered', () => {
    expect(listGames({})).toEqual([])
  })

  it('orders games by `order`, then by id for ties', () => {
    const games = { b: game('b', 1), c: game('c', 0), a: game('a', 1) }

    expect(listGames(games).map(g => g.id)).toEqual(['c', 'a', 'b'])
  })

  it('skips entries a layer has explicitly unset', () => {
    expect(listGames({ a: game('a', 0), removed: undefined })).toEqual([game('a', 0)])
  })
})
