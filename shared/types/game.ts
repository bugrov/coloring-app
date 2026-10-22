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
  /** Name of the route the game starts from (the game layer's `routes.ts`). */
  entry: string
  /** Position in the game list, ascending. */
  order: number
  /** Name of the route the game's administration starts from; the admin home links to it. */
  adminEntry?: string
}
