// https://nuxt.com/docs/api/configuration/nuxt-config
// Root app: only wires tooling. Product code lives in layers/ (auto-registered):
// layers/core is the shared platform, every other layer is a mini-game.
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/test-utils/module'],

  devtools: { enabled: true },

  compatibilityDate: '2025-07-15',

  typescript: {
    strict: true,
  },

  eslint: {
    config: {
      stylistic: true,
    },
  },
})
