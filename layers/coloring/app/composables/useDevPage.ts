/**
 * The developer pages (the SVG lab, the engine sandbox) exist for development and for the tests, which
 * run a production build with `NUXT_PUBLIC_DEV_PAGES=true`. Anywhere else they do not exist: 404.
 */
export function useDevPage() {
  if (!import.meta.dev && !useRuntimeConfig().public.devPages) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', fatal: true })
  }
}
