<script setup lang="ts">
defineProps<{
  /** Stroke width of the sample line. */
  stroke: number
}>()
</script>

<template>
  <svg
    viewBox="0 0 28 28"
    width="28"
    height="28"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path
      d="M5 22 L23 6"
      :stroke-width="stroke"
    />
  </svg>
</template>
