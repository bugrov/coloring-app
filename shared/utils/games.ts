import type { GameDefinition } from '../types/game'

/** Turns the merged `games` map from app config into an ordered list. */
export function listGames(games: Partial<Record<string, GameDefinition>>): GameDefinition[] {
  return Object.values(games)
    .filter((game): game is GameDefinition => game !== undefined)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}
