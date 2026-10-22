import { fileURLToPath } from 'node:url'

const ownSharedTypes = fileURLToPath(new URL('./shared/types', import.meta.url)).replaceAll('\\', '/')

function isOwnSharedTypes(dir: string): boolean {
  return dir.replaceAll('\\', '/') === ownSharedTypes
}

// "Coloring" mini-game layer. May depend on layers/core, never on other games.
export default defineNuxtConfig({
  runtimeConfig: {
    // The id of the private Vercel Blob store that holds the gallery thumbnails. Vercel provides it as
    // BLOB_STORE_ID, a name Nuxt does not map to a key by itself (only NUXT_-prefixed ones), so the
    // provided variable is read once here, when the config is built; NUXT_BLOB_STORE_ID overrides it at runtime.
    blobStoreId: process.env.BLOB_STORE_ID ?? '',
    // Keeps thumbnails in the memory of the server process when there is no Blob store: for local development
    // and the e2e server only (NUXT_MEMORY_THUMBNAILS=true). Production without a store answers 503 instead.
    memoryThumbnails: false,
  },

  routeRules: {
    // Canvas and file tools work on the client only; no point rendering them on the server.
    '/coloring/lab': { ssr: false },
    '/coloring/art/**': { ssr: false },
    '/coloring/sandbox': { ssr: false },
    // Every import costs CPU (parsing) even when the file is rejected, so failures count too.
    // The body is an SVG file: the XSS validator of nuxt-security would reject its markup.
    '/api/coloring/imports': { security: { rateLimiter: { tokensPerInterval: 30, interval: 300_000 }, xssValidator: false } },
    // The editor saves a batch every few seconds while someone draws, and a class may share one IP.
    // The body is numbers and colours checked by a strict schema: the XSS scan would only cost CPU.
    // An SVG upload of the administrator: the body is a file, so no XSS scan (the server converts it and stores only its own format).
    '/api/admin/coloring/arts': { security: { xssValidator: false } },
    // A thumbnail is a small image, uploaded now and then while someone draws.
    '/api/coloring/arts/*/thumbnail': { security: { rateLimiter: { tokensPerInterval: 600, interval: 60_000 }, xssValidator: false } },
    '/api/coloring/arts/*/history': { security: { rateLimiter: { tokensPerInterval: 1200, interval: 60_000 }, xssValidator: false } },
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
