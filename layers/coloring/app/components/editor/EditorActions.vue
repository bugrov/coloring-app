<script setup lang="ts">
import { ColoringRoutes } from '../../../shared/routes'
import cameraImage from '../../assets/editor/camera.svg'
import homeImage from '../../assets/editor/home.svg'

defineProps<{
  /** Restarting makes no sense while the picture is empty. */
  canRestart: boolean
}>()

const emit = defineEmits<{ share: [], restart: [] }>()

const editor = useEditorStore()
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
        aria-label="Начать заново"
        :disabled="!canRestart"
        @click="emit('restart')"
      >
        <svg
          viewBox="0 0 24 24"
          width="28"
          height="28"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M4 12a8 8 0 1 0 2.6-5.9" />
          <path d="M4 4v5h5" />
        </svg>
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
  width: 48px;
  height: 48px;
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
