<script setup lang="ts">
import { PALETTE } from '../../../shared'
import type { Tool } from '../../../shared'
import brushImage from '../../assets/editor/brush.svg'
import eraserImage from '../../assets/editor/eraser.svg'
import pencilImage from '../../assets/editor/pencil.svg'

// Top to bottom, as in the design.
const TOOLS: { name: Tool, label: string, image: string, flipped: boolean }[] = [
  { name: 'brush', label: 'Кисть', image: brushImage, flipped: false },
  { name: 'pencil', label: 'Карандаш', image: pencilImage, flipped: true },
  { name: 'eraser', label: 'Резинка', image: eraserImage, flipped: true },
]
/** At most this many crayons animate one after another when the palette opens (about 250 ms in all). */
const STAGGER_COUNT = 8

const editor = useEditorStore()
const root = ref<HTMLElement>()
const palette = ref<HTMLElement>()

function colorName(hex: string): string {
  return PALETTE.find(entry => entry.hex === hex)?.name ?? hex
}

/** Position counted from the bottom crayon, capped: the first ones in view arrive in a quick sequence. */
function staggerIndex(index: number): number {
  return Math.min(PALETTE.length - 1 - index, STAGGER_COUNT)
}

function pickRecent(hex: string) {
  // The chosen crayon opens the palette; any other one just becomes the chosen colour.
  if (hex === editor.color) editor.togglePalette(true)
  else editor.selectColor(hex)
}

function pickFromPalette(hex: string) {
  editor.selectColor(hex)
  editor.togglePalette(false)
}

// A tap outside the toolbar or Escape closes the palette.
function onPointerDown(event: PointerEvent) {
  if (editor.paletteOpen && root.value && !root.value.contains(event.target as Node)) editor.togglePalette(false)
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))

// Show the chosen colour in the middle of the list when it opens.
watch(() => editor.paletteOpen, (open) => {
  if (!open) return
  nextTick(() => {
    const list = palette.value
    const chosen = list?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (list && chosen) list.scrollTop = chosen.offsetTop - (list.clientHeight - chosen.offsetHeight) / 2
  })
})
</script>

<template>
  <nav
    ref="root"
    class="toolbar"
    :class="{ 'toolbar--palette': editor.paletteOpen }"
    aria-label="Инструменты и цвета"
    @keydown.esc="editor.togglePalette(false)"
  >
    <div
      class="toolbar__tools"
      role="radiogroup"
      aria-label="Инструмент"
      :inert="editor.paletteOpen"
    >
      <button
        v-for="tool in TOOLS"
        :key="tool.name"
        type="button"
        role="radio"
        class="toolbar__item"
        :class="{ 'toolbar__item--chosen': editor.tool === tool.name }"
        :aria-checked="editor.tool === tool.name"
        :aria-label="tool.label"
        @click="editor.tool = tool.name"
      >
        <img
          class="toolbar__tool"
          :class="{ 'toolbar__tool--flipped': tool.flipped }"
          :src="tool.image"
          alt=""
          draggable="false"
        >
      </button>
    </div>

    <TransitionGroup
      tag="div"
      name="toolbar-recent"
      class="toolbar__recent"
      role="group"
      aria-label="Недавние цвета"
      :inert="editor.paletteOpen"
    >
      <button
        v-for="hex in editor.recentColors"
        :key="hex"
        type="button"
        class="toolbar__item"
        :class="{ 'toolbar__item--chosen': hex === editor.color }"
        :aria-pressed="hex === editor.color"
        :aria-label="hex === editor.color ? `${colorName(hex)}, открыть все цвета` : colorName(hex)"
        @click="pickRecent(hex)"
      >
        <EditorPencil :color="hex" />
      </button>
    </TransitionGroup>

    <div
      v-if="editor.paletteOpen"
      ref="palette"
      class="toolbar__palette"
      role="group"
      aria-label="Все цвета"
    >
      <button
        v-for="(swatch, index) in PALETTE"
        :key="swatch.hex"
        type="button"
        class="toolbar__item toolbar__item--arriving"
        :class="{ 'toolbar__item--chosen': swatch.hex === editor.color }"
        :style="{ '--i': staggerIndex(index) }"
        :aria-pressed="swatch.hex === editor.color"
        :aria-label="swatch.name"
        @click="pickFromPalette(swatch.hex)"
      >
        <EditorPencil :color="swatch.hex" />
      </button>
    </div>
  </nav>
</template>

<style scoped lang="scss">
.toolbar {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  overflow: hidden;
}

.toolbar__tools,
.toolbar__recent,
.toolbar__palette {
  display: flex;
  flex-direction: column;
  gap: var(--pencil-gap);
}

.toolbar__tools {
  transition:
    transform var(--duration-base) var(--ease-out),
    opacity var(--duration-fast);
}

.toolbar__recent {
  transition: opacity var(--duration-fast);
}

// The palette takes the whole column: the tools slide up out of the way, the recent crayons fade.
.toolbar--palette .toolbar__tools {
  opacity: 0;
  transform: translateY(-100%);
}

.toolbar--palette .toolbar__recent {
  opacity: 0;
}

.toolbar__palette {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.toolbar__item {
  flex: none;
  width: var(--rail-width);
  height: var(--pencil-height);
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;

  // Idle crayons hide behind the screen edge and leave their tip; the chosen one comes out.
  transform: translateX(var(--pencil-hidden));
  transition: transform var(--duration-base) var(--ease-out);
  -webkit-tap-highlight-color: transparent;
}

.toolbar__item--chosen {
  transform: none;
}

.toolbar__item:focus-visible {
  outline: 3px solid var(--color-progress);
  outline-offset: -3px;
  border-radius: var(--radius-m);
}

.toolbar__tool {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.toolbar__tool--flipped {
  transform: scaleY(-1);
}

.toolbar__item--arriving {
  animation: toolbar-arrive var(--duration-fast) var(--ease-out) both;
  animation-delay: calc(var(--i) * 12ms);
}

// Crayons swap places when a colour is picked.
.toolbar-recent-move {
  transition: transform var(--duration-base) var(--ease-out);
}

@keyframes toolbar-arrive {
  // The resting transform is the end value: it differs for idle and chosen crayons.
  from {
    opacity: 0;
    transform: translateX(var(--rail-width));
  }
}

@media (prefers-reduced-motion: reduce) {
  .toolbar__tools,
  .toolbar__recent,
  .toolbar__item,
  .toolbar-recent-move {
    transition: none;
  }

  .toolbar__item--arriving {
    animation: none;
  }
}
</style>
