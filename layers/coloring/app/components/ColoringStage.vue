<script setup lang="ts">
import type { ColoringArt, Op, Tool } from '../../shared'
import type { Progress } from '../engine'
import type { ColoringStageHandle } from '../composables/useColoringStage'

const props = defineProps<{
  art: ColoringArt
  tool: Tool
  color: string
}>()

const emit = defineEmits<{
  ops: [ops: Op[]]
  progress: [progress: Progress]
}>()

const stage = useTemplateRef<HTMLElement>('stage')
const content = useTemplateRef<HTMLElement>('content')
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')

const { contentStyle, handle } = useColoringStage({ stage, content, canvas }, {
  art: toRef(props, 'art'),
  tool: toRef(props, 'tool'),
  color: toRef(props, 'color'),
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
  </div>
</template>

<style scoped lang="scss">
.coloring-stage {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  container-type: size;
  touch-action: none;
  cursor: crosshair;
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
