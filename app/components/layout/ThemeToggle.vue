<template>
  <Button
    variant="ghost"
    size="icon"
    :aria-label="ariaLabel"
    :title="ariaLabel"
    class="text-muted-foreground"
    @click="toggleTheme"
  >
    <Sun v-if="!showsDarkIcon" class="size-4" />
    <Moon v-else class="size-4" />
    <span class="sr-only">{{ ariaLabel }}</span>
  </Button>
</template>

<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'

const { isDark, toggleTheme } = useTheme()

const hasMounted = ref(false)

onMounted(() => {
  hasMounted.value = true
})

const showsDarkIcon = computed(() => hasMounted.value && isDark.value)

const ariaLabel = computed(() => {
  if (!hasMounted.value) return 'Toggle theme'
  return isDark.value ? 'Switch to light mode' : 'Switch to dark mode'
})
</script>
