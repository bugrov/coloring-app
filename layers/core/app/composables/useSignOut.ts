import { CoreRoutes, type CoreRoute } from '../../shared/routes'

/** Ends the session (the module's own endpoint clears the cookie) and returns to the sign-in page (or the one named). */
export function useSignOut(redirectTo: CoreRoute = CoreRoutes.LOGIN): () => Promise<void> {
  const { clear } = useUserSession()

  return async function signOut() {
    await clear()
    await navigateTo({ name: redirectTo })
  }
}
