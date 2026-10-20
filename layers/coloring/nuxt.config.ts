// "Coloring" mini-game layer. May depend on layers/core, never on other games.
export default defineNuxtConfig({
  routeRules: {
    // Canvas and file tools work on the client only; no point rendering them on the server.
    '/coloring/lab': { ssr: false },
  },
})
