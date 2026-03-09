export function useScrollReveal() {
  onMounted(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.15 },
    )

    document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el))

    onUnmounted(() => observer.disconnect())
  })
}
