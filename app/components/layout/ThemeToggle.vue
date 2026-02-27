<template>
  <Button
    variant="ghost"
    size="icon"
    :aria-label="ariaLabel"
    :title="ariaLabel"
    class="text-muted-foreground"
    @click="toggleTheme"
  >
    <Sun v-if="!isDark" class="size-4" />
    <Moon v-else class="size-4" />
    <span class="sr-only">{{ ariaLabel }}</span>
  </Button>
</template>

<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'

const { isDark, toggleTheme } = useTheme()

const ariaLabel = computed(() => (isDark.value ? 'Switch to light mode' : 'Switch to dark mode'))
</script>
