import { CoreRoutes } from '../../shared/routes'

// Route protection for the interface. The server checks every API call on its own
// (requireUser / requireAdmin); this only keeps people off pages they cannot use.
// Pages declare who may open them in `definePageMeta({ auth })`; the default is a signed-in player.
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, user } = useUserSession()

  const required = to.meta.auth ?? 'user'
  const role = user.value?.role
  const home = { name: role === 'admin' ? CoreRoutes.ADMIN : CoreRoutes.HOME }

  if (required === 'public') {
    // Someone already signed in as this sign-in page's kind of user has no business on it.
    // A player may still open the admin sign-in page, and the admin the player one, to switch.
    const signedInHere = (to.name === CoreRoutes.LOGIN && role === 'user')
      || (to.name === CoreRoutes.ADMIN_LOGIN && role === 'admin')

    if (loggedIn.value && signedInHere) return navigateTo(home)

    return
  }

  // A session without a role (an old cookie) counts as signed out: it must not bounce between pages.
  if (!loggedIn.value || !role) return navigateTo({ name: required === 'admin' ? CoreRoutes.ADMIN_LOGIN : CoreRoutes.LOGIN })
  // Signed in with the wrong role: send each role to its own home, never to a page that sends them back.
  if (role !== required) return navigateTo(home)
})
