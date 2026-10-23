<script setup lang="ts">
import '@fontsource/rubik-bubbles/latin-400.css'

defineProps<{
  /** Whole percent, 0-100. */
  percent: number
  /** The picture was just finished: the frame plays its celebration once. */
  celebrating: boolean
}>()

const emit = defineEmits<{ celebrated: [] }>()

// Same values as the gallery card (--border-card, --radius-card): the progress band paints over the frame.
const BAND = 16
const RADIUS = 64
</script>

<template>
  <div
    class="frame"
    :class="{ 'frame--celebrating': celebrating }"
    @animationend.self="emit('celebrated')"
  >
    <div class="frame__inner">
      <slot />
    </div>
    <GalleryProgressFrame
      :percent="percent"
      :band="BAND"
      :radius="RADIUS"
    />
    <div class="frame__status">
      <slot name="status" />
    </div>
    <p class="frame__percent">
      <span class="frame__hint">Закрашено </span>{{ percent }}%
    </p>
    <div class="frame__plate">
      <slot name="plate" />
    </div>
    <div class="frame__corner">
      <slot name="corner" />
    </div>
  </div>
</template>

<style scoped lang="scss">
// Figma "Coloring — Art": the art sits in the same pale frame as a gallery card.
.frame {
  position: relative;
  height: 100%;
  padding: var(--border-card);
  border-radius: var(--radius-card);
  background: var(--color-card-frame);
}

// The undo/redo plate lies over the bottom edge of the white area: the art stops above it, so that its
// lowest lines are not under the plate on screens that are not tall (the stage keeps the art out of
// that strip, and the background goes on under the plate; drop the inset to take this back).
.frame__inner {
  --stage-inset-bottom: var(--plate-height);

  position: relative;
  height: 100%;
  overflow: hidden;
  border-radius: calc(var(--radius-card) - var(--border-card));
  background: var(--color-surface);
}

.frame__percent {
  position: absolute;
  top: calc(42px * var(--ui-scale));
  right: calc(45px * var(--ui-scale));
  margin: 0;
  font-family: "Rubik Bubbles", var(--font-family);
  font-size: calc(32px * var(--ui-scale));
  line-height: calc(32px * var(--ui-scale));
  letter-spacing: 0.2px;
  pointer-events: none;
}

// Top-left corner of the picture, mirroring the percent in the top-right one.
.frame__status {
  position: absolute;
  top: calc(48px * var(--ui-scale));
  left: calc(45px * var(--ui-scale));
  pointer-events: none;
}

// Read out by screen readers, invisible on screen.
.frame__hint {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

// The plate overlaps the bottom edge of the white area.
.frame__plate {
  position: absolute;
  bottom: var(--border-card);
  left: 50%;
  transform: translateX(-50%);
}

// Bottom-right corner of the white area, level with the undo/redo plate.
.frame__corner {
  position: absolute;
  right: calc(var(--border-card) + 20px * var(--ui-scale));
  bottom: calc(var(--border-card) + (var(--plate-height) - 44px * var(--ui-scale)) / 2);
}

// 100%: the whole frame shakes; players who prefer less motion get a glow instead.
.frame--celebrating {
  animation: frame-shake 450ms ease-in-out;
}

.frame::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: 0 0 0 6px var(--color-progress), 0 0 32px 8px var(--color-progress);
  opacity: 0;
  pointer-events: none;
}

@keyframes frame-shake {
  0%,
  100% {
    transform: none;
  }

  20%,
  60% {
    transform: translateX(-8px) rotate(-0.6deg);
  }

  40%,
  80% {
    transform: translateX(8px) rotate(0.6deg);
  }
}

@keyframes frame-glow {
  0%,
  100% {
    opacity: 0;
  }

  30%,
  70% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .frame--celebrating {
    animation: none;
  }

  .frame--celebrating::after {
    animation: frame-glow 900ms ease-in-out;
  }
}
</style>
