export default defineNuxtRouteMiddleware(async (to) => {
  const { initialize, isAuthenticated, loading } = useAuth()

  await initialize()

  // Wait for auth state to resolve
  if (loading.value) return

  const publicPages = ['/', '/login', '/register']
  const isPublicPage = publicPages.includes(to.path)

  if (!isAuthenticated.value && !isPublicPage) {
    return navigateTo('/login')
  }

  if (isAuthenticated.value && isPublicPage) {
    return navigateTo('/home')
  }
})
