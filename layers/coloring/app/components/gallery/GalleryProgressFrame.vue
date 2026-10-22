<script setup lang="ts">
import { progressDashOffset, progressFramePath } from '../../utils/progress-frame'

const props = defineProps<{
  /** Whole percent, 0-100. */
  percent: number
  /** Width of the frame band in px: the card border it paints over. */
  band: number
  /** Corner radius of the outer edge of the card in px. */
  radius: number
}>()

// Server render and first client render use the design size; the real size arrives after mount,
// so the markup matches while hydrating. A card of another size would show the frame drawn for the
// design size, then jump: the line stays invisible until the real size is known.
const DESIGN_SIZE = { width: 257, height: 200 }

const root = ref<SVGSVGElement>()
const size = ref({ ...DESIGN_SIZE })
const measured = ref(false)

useResizeObserver(root, (box) => {
  size.value = { width: box.width, height: box.height }
  measured.value = true
})

const path = computed(() => progressFramePath(size.value.width, size.value.height, props.band / 2, props.radius - props.band / 2))
const offset = computed(() => progressDashOffset(props.percent))
</script>

<template>
  <svg
    ref="root"
    class="progress-frame"
    :viewBox="`0 0 ${size.width} ${size.height}`"
    aria-hidden="true"
  >
    <path
      v-if="percent > 0"
      :class="{ 'progress-frame__line--shown': measured }"
      :d="path"
      :stroke-width="band"
      pathLength="1"
      stroke-dasharray="1"
      :stroke-dashoffset="offset"
    />
  </svg>
</template>

<style scoped lang="scss">
.progress-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;

  path {
    fill: none;
    stroke: var(--color-progress);
    stroke-linecap: butt;
    opacity: 0;
    transition: opacity var(--duration-base) var(--ease-out);

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }
}

.progress-frame path.progress-frame__line--shown {
  opacity: 1;
}
</style>
