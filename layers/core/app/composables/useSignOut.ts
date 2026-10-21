/** Ends the session (the module's own endpoint clears the cookie) and returns to the sign-in page. */
export function useSignOut(redirectTo = '/login'): () => Promise<void> {
  const { clear } = useUserSession()

  return async function signOut() {
    await clear()
    await navigateTo(redirectTo)
  }
}
