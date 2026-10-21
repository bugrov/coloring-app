// Route protection for the interface. The server checks every API call on its own
// (requireUser / requireAdmin); this only keeps people off pages they cannot use.
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, user } = useUserSession()

  // '/login/' is the same page as '/login'.
  const path = to.path.length > 1 ? to.path.replace(/\/+$/, '') : to.path
  const isAdminArea = path === '/admin' || path.startsWith('/admin/')
  const required = to.meta.auth ?? (isAdminArea ? 'admin' : 'user')
  const signInPage = isAdminArea ? '/admin/login' : '/login'
  const home = user.value?.role === 'admin' ? '/admin' : '/'

  if (required === 'public') {
    // Someone already signed in as this page's kind of user has no business on its sign-in page.
    // A player may still open the admin sign-in page, and the admin the player one, to switch.
    const signedInHere = user.value?.role === (isAdminArea ? 'admin' : 'user')
    if (loggedIn.value && path === signInPage && signedInHere) return navigateTo(home)
    return
  }

  if (!loggedIn.value) return navigateTo(signInPage)
  // Signed in with the wrong role: send each role to its own home, never to a page that sends them back.
  if (user.value?.role !== required) return navigateTo(home)
})
