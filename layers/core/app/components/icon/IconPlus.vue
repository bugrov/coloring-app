<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 64 })
</script>

<template>
  <svg
    viewBox="0 0 64 64"
    :width="size"
    :height="size"
    fill="currentColor"
    aria-hidden="true"
  >
    <rect
      x="0"
      y="24"
      width="64"
      height="16"
      rx="8"
    />
    <rect
      x="24"
      y="0"
      width="16"
      height="64"
      rx="8"
    />
  </svg>
</template>
