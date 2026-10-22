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
  padding-block: var(--space-4);
}

.actions__home,
.actions__camera {
  display: grid;
  place-items: center;

  @include plain-button;
}

.actions__home img {
  display: block;
  width: 64px;
  height: 60px;
}

// The camera sits on a white disc in the design, tilted.
.actions__camera {
  width: 79px;
  height: 79px;
  border-radius: 50%;
  background: var(--color-surface);
}

.actions__camera img {
  display: block;
  width: 64px;
  height: 65px;
  transform: rotate(-15deg);
}

.actions__settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.actions__round {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  color: var(--color-text);
  font: inherit;
  font-size: 0.75rem;
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
  width: 14px;
  height: 14px;
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
