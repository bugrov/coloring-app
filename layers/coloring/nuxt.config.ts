import { fileURLToPath } from 'node:url'

const ownSharedTypes = fileURLToPath(new URL('./shared/types', import.meta.url)).replaceAll('\\', '/')
const isOwnSharedTypes = (dir: string) => dir.replaceAll('\\', '/') === ownSharedTypes

// "Coloring" mini-game layer. May depend on layers/core, never on other games.
export default defineNuxtConfig({
  routeRules: {
    // Canvas and file tools work on the client only; no point rendering them on the server.
    '/coloring/lab': { ssr: false },
    '/coloring/sandbox': { ssr: false },
  },

  // Nuxt (client) and Nitro (server) auto-import every layer's shared/types globally.
  // Game types must stay private to the game (core must not see them), so they are
  // imported explicitly from layers/coloring/shared instead.
  hooks: {
    'imports:dirs'(dirs) {
      const index = dirs.findIndex(isOwnSharedTypes)
      if (index !== -1) dirs.splice(index, 1)
    },
    'nitro:config'(config) {
      if (config.imports) config.imports.dirs = config.imports.dirs?.filter(dir => typeof dir !== 'string' || !isOwnSharedTypes(dir))
    },
  },
})
