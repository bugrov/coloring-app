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
  transition:
    transform var(--duration-fast) var(--ease-out),
    filter var(--duration-fast),
    opacity var(--duration-fast);

  @include plain-button;
}

// The arrow leans the way it points and lifts on a deep shadow; pressed, it sinks back.
@media (hover: hover) {
  .history__button:hover:not(:disabled) {
    filter: drop-shadow(0 5px 6px rgb(35 38 47 / 40%));
    transform: translateY(-2px) rotate(-14deg) scale(1.1);
  }

  .history__button--redo:hover:not(:disabled) {
    transform: translateY(-2px) rotate(14deg) scale(1.1);
  }
}

.history__button:active:not(:disabled) {
  filter: none;
  transform: scale(0.92);
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
