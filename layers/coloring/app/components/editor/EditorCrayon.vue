<script setup lang="ts">
import type { Tool } from '../../../shared'

// The colour swatch of the panel: a brush while the brush is chosen, a pencil otherwise.
defineProps<{ color: string, tool: Tool }>()
</script>

<template>
  <EditorBrush
    v-if="tool === 'brush'"
    :color="color"
  />
  <EditorPencil
    v-else
    :color="color"
  />
</template>
