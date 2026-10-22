<script setup lang="ts">
// The attributes fall through to the <select>, the options come in the default slot.
defineProps<{
  /** The field sits on a white card instead of the page colour. */
  onSurface?: boolean
}>()

const model = defineModel<string>()
</script>

<template>
  <select
    v-model="model"
    class="form-input"
    :class="{ 'form-input--on-surface': onSurface }"
  >
    <slot />
  </select>
</template>
