<script setup lang="ts">
// The second "start over" button, in the corner of the picture: same action as the one in the left rail.
defineProps<{
  /** Restarting makes no sense while the picture is empty. */
  disabled: boolean
}>()

defineEmits<{ restart: [] }>()
</script>

<template>
  <button
    type="button"
    class="restart-corner"
    aria-label="Начать заново"
    title="Начать заново"
    :disabled="disabled"
    @click="$emit('restart')"
  >
    <IconRestart />
  </button>
</template>

<style scoped lang="scss">
.restart-corner {
  display: grid;
  place-items: center;
  width: calc(44px * var(--ui-scale));
  height: calc(44px * var(--ui-scale));
  border-radius: 50%;
  background: var(--color-surface);
  box-shadow: 0 2px 8px rgb(35 38 47 / 18%);
  color: var(--color-text);
  transition:
    transform var(--duration-fast) var(--ease-out),
    filter var(--duration-fast),
    opacity var(--duration-fast);

  @include plain-button;
}

.restart-corner:active:not(:disabled) {
  transform: scale(0.92);
}

@media (hover: hover) {
  .restart-corner:hover:not(:disabled) {
    transform: scale(1.06);
  }
}

@media (prefers-reduced-motion: reduce) {
  .restart-corner {
    transition: none;
  }
}
</style>
