<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 64 })
</script>

<template>
  <svg
    class="icon-spinner"
    viewBox="0 0 64 64"
    :width="size"
    :height="size"
    aria-hidden="true"
  >
    <circle
      cx="32"
      cy="32"
      r="24"
    />
  </svg>
</template>

<style scoped lang="scss">
// A 3/4 arc turning in place: transform only, and still when the user asks for less motion.
.icon-spinner {
  animation: icon-spinner-turn 0.9s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

.icon-spinner circle {
  fill: none;
  stroke: currentcolor;
  stroke-dasharray: 113 38;
  stroke-linecap: round;
  stroke-width: 12;
}

@keyframes icon-spinner-turn {
  to {
    transform: rotate(360deg);
  }
}
</style>
