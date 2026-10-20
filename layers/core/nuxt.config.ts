import { fileURLToPath } from 'node:url'

// `~` in a layer config points at the root app, so layer files are resolved
// relative to this config instead.
const resolveLayer = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// Core platform layer: app shell, "game mode" behaviour, shared UI.
// Must not depend on any game layer (enforced in eslint.config.mjs).
export default defineNuxtConfig({
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'Раскраска',
      meta: [
        // viewport-fit=cover lets the layout reach under notches and the home
        // indicator; safe-area insets keep controls out of those zones.
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#f4f7fb' },
        { name: 'format-detection', content: 'telephone=no' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      ],
    },
  },

  css: [resolveLayer('./app/assets/styles/main.scss')],
})
