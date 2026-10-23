<script setup lang="ts">
import { DEFAULT_OPACITY } from '../../shared'
import type { ColoringArt, Op, Tool } from '../../shared'
import { DEFAULT_THICKNESS, HOLD_DURATION_MS, sheetOf, type PaintDelta, type Progress, type SheetOrientation } from '../engine'
import type { ColoringStageHandle, HoldFeedback } from '../composables/useColoringStage'

const props = withDefaults(defineProps<{
  art: ColoringArt
  tool: Tool
  color: string
  /** Paint opacity in percent. */
  opacity?: number
  /** Multiplier of the tool's line width. */
  thickness?: number
  /** The player cannot draw while true; zoom and pan still work. */
  locked?: boolean
  /** Share of a region that counts it as coloured; the engine default when absent. */
  tolerance?: number
}>(), { opacity: DEFAULT_OPACITY, thickness: DEFAULT_THICKNESS, locked: false, tolerance: undefined })

const emit = defineEmits<{
  ops: [ops: Op[], delta: PaintDelta | null]
  progress: [progress: Progress]
  /** The canvas is ready for a picture to be put on it. */
  ready: []
}>()

const stage = useTemplateRef<HTMLElement>('stage')
const content = useTemplateRef<HTMLElement>('content')
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')

/** Long-press feedback: a ring that closes while the finger rests, a burst of colour when it fills. */
const hold = ref<(Pick<HoldFeedback, 'x' | 'y' | 'color'> & { kind: 'ring' | 'burst' }) | null>(null)

function onHold({ phase, ...spot }: HoldFeedback) {
  hold.value = phase === 'cancel' ? null : { ...spot, kind: phase === 'start' ? 'ring' : 'burst' }
}

function onHoldAnimationEnd() {
  if (hold.value?.kind === 'burst') hold.value = null
}

/**
 * Which way the sheet is stretched follows the stage: wide when it is wider than high, tall when it is
 * higher. Between the two (a nearly square stage) it stays as it is, so a window dragged across the
 * line does not rebuild the picture over and over.
 */
const ORIENTATION_MARGIN = 1.1

const orientation = ref<SheetOrientation>(import.meta.client && window.innerWidth < window.innerHeight ? 'tall' : 'wide')

useResizeObserver(stage, ({ width, height }) => {
  if (width > height * ORIENTATION_MARGIN) orientation.value = 'wide'
  else if (width * ORIENTATION_MARGIN < height) orientation.value = 'tall'
})

const { contentStyle, handle } = useColoringStage({ stage, content, canvas }, {
  art: toRef(props, 'art'),
  tool: toRef(props, 'tool'),
  color: toRef(props, 'color'),
  opacity: toRef(props, 'opacity'),
  thickness: toRef(props, 'thickness'),
  locked: toRef(props, 'locked'),
  orientation,
  tolerance: toRef(props, 'tolerance'),
  onReady: () => emit('ready'),
  onHold,
  onOps: (ops, delta) => emit('ops', ops, delta),
  onProgress: progress => emit('progress', progress),
})

/**
 * Where the art lies on its sheet, as shares of the sheet; the sheet is laid out around the art, which
 * keeps its place and size however wide the stage is (the stage cuts off what does not fit).
 */
const layout = computed(() => {
  const [x, y, width, height] = props.art.viewBox
  const sheet = sheetOf(props.art.viewBox, orientation.value)

  return {
    '--ratio': width / height,
    '--sheet-scale': sheet.width / width,
    '--sheet-aspect': sheet.width / sheet.height,
    '--art-left': `${((x - sheet.x) / sheet.width) * 100}%`,
    '--art-center-y': (y - sheet.y + height / 2) / sheet.height,
    '--art-top': `${((y - sheet.y) / sheet.height) * 100}%`,
    '--art-width': `${(width / sheet.width) * 100}%`,
    '--art-height': `${(height / sheet.height) * 100}%`,
  }
})

defineExpose<ColoringStageHandle>(handle)
</script>

<template>
  <div
    ref="stage"
    class="coloring-stage"
  >
    <div
      ref="content"
      class="coloring-stage__content"
      :style="contentStyle"
    >
      <div
        class="coloring-stage__sheet"
        :style="layout"
      >
        <canvas
          ref="canvas"
          class="coloring-stage__layer"
        />
        <!-- Line art over the paint: multiply keeps outlines on top and the paint visible through white areas. -->
        <ArtPreview
          class="coloring-stage__art"
          :art="art"
        />
      </div>
    </div>
    <span
      v-if="hold"
      :key="hold.kind"
      class="coloring-stage__hold"
      :class="`coloring-stage__hold--${hold.kind}`"
      :style="{ '--x': `${hold.x}px`, '--y': `${hold.y}px`, '--hold-color': hold.color ?? 'var(--color-text-muted)', '--hold-duration': `${HOLD_DURATION_MS}ms` }"
      @animationend="onHoldAnimationEnd"
    />
  </div>
</template>

<style scoped lang="scss">
.coloring-stage {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  container-type: size;
  touch-action: none;
  cursor: crosshair;
}

.coloring-stage__hold {
  --size: 56px;

  position: absolute;
  top: calc(var(--y) - var(--size) / 2);
  left: calc(var(--x) - var(--size) / 2);
  width: var(--size);
  height: var(--size);
  border: 4px solid var(--hold-color);
  border-radius: 50%;
  pointer-events: none;
}

.coloring-stage__hold--ring {
  animation: hold-ring var(--hold-duration) linear forwards;
}

.coloring-stage__hold--burst {
  background: var(--hold-color);
  animation: hold-burst 250ms ease-out forwards;
}

@keyframes hold-ring {
  from {
    opacity: 0.2;
    transform: scale(1.6);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes hold-burst {
  from {
    opacity: 0.5;
    transform: scale(1);
  }

  to {
    opacity: 0;
    transform: scale(5);
  }
}

@media (prefers-reduced-motion: reduce) {
  // Without motion the ring is simply there while the finger rests; the fill itself is instant.
  .coloring-stage__hold--ring {
    animation: none;
  }

  .coloring-stage__hold--burst {
    display: none;
  }
}

.coloring-stage__content {
  position: relative;
  width: 100%;
  height: 100%;
  background: #fff;
  isolation: isolate;
  transform-origin: 0 0;

  // No `will-change: transform`: a permanently promoted layer is not
  // re-rasterized after zooming, which would blur the vector line art.
}

// The sheet: the art (as big as the stage allows) with the background carried on around it. It is
// centred and may be wider than the stage, which cuts off the rest.
.coloring-stage__sheet {
  position: absolute;

  // `--stage-inset-bottom`: the part of the stage's foot that something lies over; the art is kept above
  // it while the background goes on underneath.
  top: calc(50% - var(--stage-inset-bottom, 0px) / 2);
  left: 50%;
  width: calc(min(100cqw, (100cqh - var(--stage-inset-bottom, 0px)) * var(--ratio)) * var(--sheet-scale));
  aspect-ratio: var(--sheet-aspect);

  // The art, not the sheet, is what sits in the middle: the sheet reaches further below it than above.
  transform: translate(-50%, calc(var(--art-center-y) * -100%));
}

.coloring-stage__layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.coloring-stage__art {
  position: absolute;
  top: var(--art-top);
  left: var(--art-left);
  width: var(--art-width);
  height: var(--art-height);
  mix-blend-mode: multiply;
  pointer-events: none;
}
</style>
