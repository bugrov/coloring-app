import { fileURLToPath } from 'node:url'
import { THEME_BG } from './theme'
import { SESSION_MAX_AGE_SECONDS } from './shared/auth'

// `~` in a layer config points at the root app, so layer files are resolved
// relative to this config instead.
const resolveLayer = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// Core platform layer: app shell, "game mode" behaviour, shared UI.
// Must not depend on any game layer (enforced in eslint.config.mjs).
export default defineNuxtConfig({
  modules: ['nuxt-auth-utils', 'nuxt-security'],

  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'Раскраска',
      meta: [
        // viewport-fit=cover lets the layout reach under notches and the home
        // indicator; safe-area insets keep controls out of those zones.
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: THEME_BG },
        { name: 'format-detection', content: 'telephone=no' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      ],
    },
  },

  css: [resolveLayer('./app/assets/styles/main.scss')],

  runtimeConfig: {
    // nuxt-auth-utils: the cookie is httpOnly, secure and sameSite=lax by default; only the lifetime is set here.
    // The cookie password comes from NUXT_SESSION_PASSWORD (at least 32 characters).
    session: { maxAge: SESSION_MAX_AGE_SECONDS },
  },

  routeRules: {
    // Sign-in is passwordless: this only blocks mass account creation. A class
    // behind one IP signs in within minutes, so the limit is generous.
    '/api/auth/login': { security: { rateLimiter: { tokensPerInterval: 60, interval: 300_000 } } },
    // Brute force of the admin password: strict.
    '/api/admin/login': { security: { rateLimiter: { tokensPerInterval: 5, interval: 300_000 } } },
  },

  vite: {
    css: {
      preprocessorOptions: {
        scss: { additionalData: `$theme-bg: ${THEME_BG};\n` },
      },
    },
  },

  security: {
    // The built-in limiter keeps its counters in memory of one server instance and
    // would also throttle classes sharing a school IP on every page; it is switched
    // on only for the sign-in routes below.
    rateLimiter: false,
  },
})
