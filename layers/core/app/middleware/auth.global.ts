// Route protection for the interface. The server checks every API call on its own
// (requireUser / requireAdmin); this only keeps people off pages they cannot use.
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, user } = useUserSession()

  const isAdminArea = to.path === '/admin' || to.path.startsWith('/admin/')
  const required = to.meta.auth ?? (isAdminArea ? 'admin' : 'user')
  const signInPage = isAdminArea ? '/admin/login' : '/login'
  const home = user.value?.role === 'admin' ? '/admin' : '/'

  if (required === 'public') {
    // A signed-in person has no business on the sign-in page.
    if (loggedIn.value && to.path === signInPage) return navigateTo(home)
    return
  }

  if (!loggedIn.value) return navigateTo(signInPage)
  // Signed in with the wrong role: send each role to its own home, never to a page that sends them back.
  if (user.value?.role !== required) return navigateTo(home)
})
