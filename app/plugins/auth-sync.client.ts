export default defineNuxtPlugin(() => {
  const { clearAuthState, authUserId } = useAuth()
  const session = useSupabaseSession()
  let previousUserId = authUserId.value

  watch(
    [session, authUserId],
    ([currentSession, currentUserId]) => {
      if (!currentSession && previousUserId) {
        previousUserId = null
        clearAuthState()
        return
      }

      // Initial login should not clear freshly bootstrapped state.
      // Only clear on an actual user switch after a user was already active.
      if (previousUserId && currentUserId && currentUserId !== previousUserId) {
        previousUserId = currentUserId
        clearAuthState()
        return
      }

      if (!previousUserId && currentUserId) {
        previousUserId = currentUserId
        return
      }

      previousUserId = currentUserId
    },
    { immediate: false },
  )
})
