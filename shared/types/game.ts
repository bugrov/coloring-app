/**
 * A mini-game plugged into the platform. Each game layer contributes its
 * definition through `app.config.ts` (`games.<id>`); core builds navigation
 * from these definitions and never imports game code directly.
 */
export interface GameDefinition {
  /** Stable identifier, unique across games. */
  id: string
  /** Human-readable name shown in the game list. */
  title: string
  /** Route the game starts from. */
  entry: string
  /** Position in the game list, ascending. */
  order: number
}
