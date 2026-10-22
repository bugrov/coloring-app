<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 96 })
</script>

<template>
  <svg
    viewBox="0 0 64 64"
    :width="size"
    :height="size"
    fill="none"
    stroke="currentColor"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect
      x="20"
      y="8"
      width="24"
      height="40"
      rx="4"
    />
    <path d="M12 44a20 20 0 0 0 20 12m0 0-4-4m4 4-4 4" />
  </svg>
</template>
