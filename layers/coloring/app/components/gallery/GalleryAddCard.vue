<script setup lang="ts">
defineProps<{
  /** A file is being imported: the button is locked and shows a spinner instead of the plus. */
  busy?: boolean
}>()
const emit = defineEmits<{ pick: [file: File] }>()

const input = ref<HTMLInputElement>()

function onChange() {
  const file = input.value?.files?.[0]

  // Clearing lets the same file be picked again after a failed import.
  if (file) emit('pick', file)
  if (input.value) input.value.value = ''
}
</script>

<template>
  <div class="gallery-add">
    <button
      class="gallery-add__button"
      type="button"
      :disabled="busy"
      :aria-busy="busy"
      :aria-label="busy ? 'Импортируем рисунок' : 'Импортировать свой SVG-рисунок'"
      @click="input?.click()"
    >
      <svg
        v-if="busy"
        class="gallery-add__spinner"
        viewBox="0 0 64 64"
        aria-hidden="true"
      >
        <circle
          cx="32"
          cy="32"
          r="24"
        />
      </svg>
      <svg
        v-else
        class="gallery-add__plus"
        viewBox="0 0 64 64"
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
    </button>
    <input
      ref="input"
      class="gallery-add__input"
      type="file"
      accept=".svg,image/svg+xml"
      tabindex="-1"
      aria-hidden="true"
      @change="onChange"
    >
  </div>
</template>

<style scoped lang="scss">
// Figma: the same frame as a card, with a sky-blue plus (64px, 16px strokes) on white.
.gallery-add {
  height: var(--card-height);
  padding: var(--border-card);
  border-radius: var(--radius-card);
  background: var(--color-card-frame);
}

.gallery-add__button {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  border: 0;
  border-radius: calc(var(--radius-card) - var(--border-card));
  background: var(--color-surface);
  cursor: pointer;
}

.gallery-add__plus {
  width: 64px;
  height: 64px;
  fill: var(--color-sky);
}

// A 3/4 arc turning in place: transform only, and still when the user asks for less motion.
.gallery-add__spinner {
  width: 64px;
  height: 64px;
  animation: gallery-add-spin 0.9s linear infinite;

  circle {
    fill: none;
    stroke: var(--color-sky);
    stroke-dasharray: 113 38;
    stroke-linecap: round;
    stroke-width: 12;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

@keyframes gallery-add-spin {
  to {
    transform: rotate(360deg);
  }
}

.gallery-add__button:disabled {
  cursor: progress;
}

.gallery-add__input {
  display: none;
}
</style>
