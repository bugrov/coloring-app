<script setup lang="ts">
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
      aria-label="Импортировать свой SVG-рисунок"
      @click="input?.click()"
    >
      <svg
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

.gallery-add__input {
  display: none;
}
</style>
