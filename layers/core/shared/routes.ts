/**
 * Names of core pages. Pages declare them in `definePageMeta({ name })` and every link,
 * redirect and `navigateTo` uses the name, never a path, so a path can change in one place.
 */
export const CoreRoutes = {
  HOME: 'home',
  LOGIN: 'login',
  ADMIN: 'admin',
  ADMIN_LOGIN: 'admin-login',
} as const

export type CoreRoute = typeof CoreRoutes[keyof typeof CoreRoutes]
