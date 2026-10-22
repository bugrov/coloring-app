<script setup lang="ts">
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
  return editor.palette.find(entry => entry.hex === hex)?.name ?? hex
}

/** Position counted from the bottom crayon, capped: the first ones in view arrive in a quick sequence. */
function staggerIndex(index: number): number {
  return Math.min(editor.palette.length - 1 - index, STAGGER_COUNT)
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

// A tap outside the toolbar closes the palette and goes no further: it must not also start a
// stroke on the canvas. Escape closes it from anywhere.
function onPointerDown(event: PointerEvent) {
  if (!editor.paletteOpen || root.value?.contains(event.target as Node)) return
  editor.togglePalette(false)
  event.stopPropagation()
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && editor.paletteOpen) editor.togglePalette(false)
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown, { capture: true })
  document.addEventListener('keydown', onKeyDown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown, { capture: true })
  document.removeEventListener('keydown', onKeyDown)
})

// Opening hides the pressed crayon behind `inert`, so focus moves into the list, on the chosen
// colour, which is also scrolled to the middle; closing brings focus back to the chosen crayon.
watch(() => editor.paletteOpen, async (open) => {
  await nextTick()

  if (open) {
    const list = palette.value
    const chosen = list?.querySelector<HTMLElement>('[aria-pressed="true"]')

    if (!list || !chosen) return
    list.scrollTop = chosen.offsetTop - (list.clientHeight - chosen.offsetHeight) / 2
    chosen.focus({ preventScroll: true })
  } else if (root.value?.contains(document.activeElement) || document.activeElement === document.body) {
    root.value?.querySelector<HTMLElement>('.toolbar__recent [aria-pressed="true"]')?.focus()
  }
})
</script>

<template>
  <nav
    ref="root"
    class="toolbar"
    :class="{ 'toolbar--palette': editor.paletteOpen }"
    aria-label="Инструменты и цвета"
  >
    <div
      class="toolbar__tools"
      role="group"
      aria-label="Инструмент"
      :inert="editor.paletteOpen"
    >
      <button
        v-for="tool in TOOLS"
        :key="tool.name"
        type="button"
        class="toolbar__item"
        :class="{ 'toolbar__item--chosen': editor.tool === tool.name }"
        :aria-pressed="editor.tool === tool.name"
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
      <!-- The slot moves when colours swap; the button inside keeps its own sideways offset. -->
      <div
        v-for="hex in editor.recentColors"
        :key="hex"
        class="toolbar__slot"
      >
        <button
          type="button"
          class="toolbar__item"
          :class="{ 'toolbar__item--chosen': hex === editor.color }"
          :aria-pressed="hex === editor.color"
          :aria-label="hex === editor.color ? `${colorName(hex)}, открыть все цвета` : colorName(hex)"
          @click="pickRecent(hex)"
        >
          <EditorPencil :color="hex" />
        </button>
      </div>
    </TransitionGroup>

    <div
      v-if="editor.paletteOpen"
      ref="palette"
      class="toolbar__palette"
      role="group"
      aria-label="Все цвета"
    >
      <button
        v-for="(swatch, index) in editor.palette"
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

  @include plain-button;

  // Idle crayons hide behind the screen edge and leave their tip; the chosen one comes out.
  transform: translateX(var(--pencil-hidden));
  transition: transform var(--duration-base) var(--ease-out);
}

.toolbar__item--chosen {
  transform: none;
}

.toolbar__item:focus-visible {
  @include focus-ring(-3px);

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

// Crayons swap places when a colour is picked; the one dropping out leaves at once.
.toolbar__slot {
  flex: none;
}

.toolbar-recent-move {
  transition: transform var(--duration-base) var(--ease-out);
}

.toolbar-recent-leave-active {
  position: absolute;
  transition: none;
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
