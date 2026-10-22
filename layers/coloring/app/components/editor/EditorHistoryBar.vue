<script setup lang="ts">
import undoImage from '../../assets/editor/undo.svg'

defineProps<{ canUndo: boolean, canRedo: boolean }>()
const emit = defineEmits<{ undo: [], redo: [] }>()
</script>

<template>
  <div class="history">
    <button
      type="button"
      class="history__button"
      aria-label="Отменить"
      :disabled="!canUndo"
      @click="emit('undo')"
    >
      <img
        :src="undoImage"
        alt=""
        draggable="false"
      >
    </button>
    <button
      type="button"
      class="history__button history__button--redo"
      aria-label="Вернуть"
      :disabled="!canRedo"
      @click="emit('redo')"
    >
      <img
        :src="undoImage"
        alt=""
        draggable="false"
      >
    </button>
  </div>
</template>

<style scoped lang="scss">
// The plate sits in the bottom edge of the frame, as in the design.
.history {
  display: flex;
  gap: var(--plate-pad);
  align-items: center;
  height: var(--plate-height);
  padding-inline: var(--plate-pad);
  border-radius: var(--radius-l) var(--radius-l) 0 0;
  background: var(--color-card-frame);
}

.history__button {
  display: grid;
  place-items: center;
  width: var(--plate-button);
  height: var(--plate-button);
  transition: opacity var(--duration-fast);

  @include plain-button;
}

.history__button:disabled {
  opacity: 0.35;
  cursor: default;
}

.history__button img {
  display: block;
  width: 100%;
  height: 100%;
}

// The same arrow mirrored: the design draws the redo arrow flipped.
.history__button--redo img {
  transform: scaleX(-1);
}

.history__button:focus-visible {
  @include focus-ring(-3px);
}

@media (prefers-reduced-motion: reduce) {
  .history__button {
    transition: none;
  }
}
</style>
