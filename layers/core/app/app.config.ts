import type { GameDefinition } from '#shared/types/game'

// Game layers register themselves by adding `games.<id>` to their own
// app.config.ts; Nuxt deep-merges app configs from all layers.
export default defineAppConfig({
  games: {} as Partial<Record<string, GameDefinition>>,
})

declare module 'nuxt/schema' {
  interface AppConfigInput {
    games?: Partial<Record<string, GameDefinition>>
  }
}
