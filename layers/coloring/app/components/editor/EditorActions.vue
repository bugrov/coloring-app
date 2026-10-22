<script setup lang="ts">
import { ColoringRoutes } from '../../../shared/routes'
import cameraImage from '../../assets/editor/camera.svg'
import homeImage from '../../assets/editor/home.svg'
import { THICKNESS_SCALES } from '../../engine'

defineProps<{
  /** Restarting makes no sense while the picture is empty. */
  canRestart: boolean
}>()

const emit = defineEmits<{ share: [], restart: [] }>()

const editor = useEditorStore()

/** Names and drawn widths (px of the 28 px icon) of the line thickness levels, in THICKNESS_SCALES order. */
const THICKNESS_LOOKS = [
  { name: 'тонкая', stroke: 3 },
  { name: 'средняя', stroke: 6 },
  { name: 'толстая', stroke: 10 },
]

const thicknessLook = computed(() => THICKNESS_LOOKS[THICKNESS_SCALES.findIndex(scale => scale === editor.thickness)] ?? THICKNESS_LOOKS[1]!)
</script>

<template>
  <div class="actions">
    <NuxtLink
      class="actions__home"
      :to="{ name: ColoringRoutes.GALLERY }"
      aria-label="К галерее"
    >
      <img
        :src="homeImage"
        alt=""
        draggable="false"
      >
    </NuxtLink>

    <div class="actions__settings">
      <button
        type="button"
        class="actions__round actions__opacity"
        :aria-label="`Прозрачность краски ${editor.opacity}%, изменить`"
        :title="`Прозрачность краски: ${editor.opacity}%`"
        @click="editor.cycleOpacity()"
      >
        <span
          class="actions__drop"
          :style="{ '--opacity': editor.opacity / 100 }"
          aria-hidden="true"
        />
        <span aria-hidden="true">{{ editor.opacity }}%</span>
      </button>
      <button
        type="button"
        class="actions__round"
        :aria-label="`Толщина линии: ${thicknessLook.name}, изменить`"
        :title="`Толщина линии: ${thicknessLook.name}`"
        @click="editor.cycleThickness()"
      >
        <EditorThicknessIcon :stroke="thicknessLook.stroke" />
      </button>
      <button
        type="button"
        class="actions__round"
        aria-label="Начать заново"
        title="Начать заново"
        :disabled="!canRestart"
        @click="emit('restart')"
      >
        <IconRestart />
      </button>
    </div>

    <button
      type="button"
      class="actions__camera"
      aria-label="Сохранить или поделиться картинкой"
      @click="emit('share')"
    >
      <img
        :src="cameraImage"
        alt=""
        draggable="false"
      >
    </button>
  </div>
</template>

<style scoped lang="scss">
.actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding-block: calc(var(--space-4) * var(--ui-scale));
}

.actions__home,
.actions__camera {
  display: grid;
  place-items: center;

  @include plain-button;
}

.actions__home img {
  display: block;
  width: calc(64px * var(--ui-scale));
  height: calc(60px * var(--ui-scale));
}

// The picture brings its own white blob (not a circle) and the tilt of the camera, as in the design,
// and the design lifts it a little above the bottom of the rail (the margins come from measuring the frames).
.actions__camera {
  width: calc(65px * var(--ui-scale));
  height: calc(64px * var(--ui-scale));
  margin: 0 0 calc(7px * var(--ui-scale)) calc(2px * var(--ui-scale));
}

.actions__camera img {
  display: block;
  width: 100%;
  height: 100%;
}

.actions__settings {
  display: flex;
  flex-direction: column;
  gap: calc(var(--space-2) * var(--ui-scale));
}

.actions__round {
  display: grid;
  place-items: center;
  width: calc(44px * var(--ui-scale));
  height: calc(44px * var(--ui-scale));
  border-radius: 50%;
  color: var(--color-text);
  font: inherit;
  font-size: calc(0.75rem * var(--ui-scale));
  font-weight: 700;

  @include plain-button;

  background: var(--color-surface);
}

.actions__round:disabled {
  opacity: 0.4;
  cursor: default;
}

.actions__opacity {
  grid-auto-flow: row;
  gap: 0;
  align-content: center;
}

// A drop of the paint colour at the current opacity, so the setting reads without the number.
.actions__drop {
  width: calc(14px * var(--ui-scale));
  height: calc(14px * var(--ui-scale));
  border-radius: 50%;
  background: var(--color-progress);
  opacity: var(--opacity);
}

.actions__home:focus-visible,
.actions__camera:focus-visible,
.actions__round:focus-visible {
  @include focus-ring;
}
</style>
