import { useColorMode } from '@vueuse/core'

export type ThemeMode = 'light' | 'dark' | 'auto'

export function useTheme() {
  const theme = useColorMode({
    selector: 'html',
    attribute: 'class',
    storageKey: 'medpractice-theme',
    initialValue: 'auto',
    emitAuto: true,
    modes: {
      light: 'light',
      dark: 'dark',
    },
  })

  const isDark = computed(() => theme.value === 'dark')

  function toggleTheme() {
    theme.value = isDark.value ? 'light' : 'dark'
  }

  function setTheme(mode: ThemeMode) {
    theme.value = mode
  }

  return {
    theme,
    isDark,
    toggleTheme,
    setTheme,
  }
}
