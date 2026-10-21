<script setup lang="ts">
import { DEFAULT_OPACITY } from '../../shared'
import type { ColoringArt, Op, Tool } from '../../shared'
import { DEFAULT_THICKNESS, HOLD_DURATION_MS, type Progress } from '../engine'
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
}>(), { opacity: DEFAULT_OPACITY, thickness: DEFAULT_THICKNESS, locked: false })

const emit = defineEmits<{
  ops: [ops: Op[]]
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

const { contentStyle, handle } = useColoringStage({ stage, content, canvas }, {
  art: toRef(props, 'art'),
  tool: toRef(props, 'tool'),
  color: toRef(props, 'color'),
  opacity: toRef(props, 'opacity'),
  thickness: toRef(props, 'thickness'),
  locked: toRef(props, 'locked'),
  onReady: () => emit('ready'),
  onHold,
  onOps: ops => emit('ops', ops),
  onProgress: progress => emit('progress', progress),
})

const aspectRatio = computed(() => props.art.viewBox[2] / props.art.viewBox[3])

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
      :style="[contentStyle, { '--ratio': aspectRatio }]"
    >
      <canvas
        ref="canvas"
        class="coloring-stage__layer"
      />
      <!-- Line art over the paint: multiply keeps outlines on top and the paint visible through white areas. -->
      <ArtPreview
        class="coloring-stage__layer coloring-stage__layer--art"
        :art="art"
      />
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
  width: min(100cqw, 100cqh * var(--ratio));
  aspect-ratio: var(--ratio);
  background: #fff;
  isolation: isolate;
  transform-origin: 0 0;

  // No `will-change: transform`: a permanently promoted layer is not
  // re-rasterized after zooming, which would blur the vector line art.
}

.coloring-stage__layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.coloring-stage__layer--art {
  mix-blend-mode: multiply;
  pointer-events: none;
}
</style>
