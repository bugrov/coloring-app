<script setup lang="ts">
import { ColoringRoutes } from '../../../shared/routes'
import type { GalleryItem } from '../../../shared'

const props = defineProps<{ item: GalleryItem }>()
const emit = defineEmits<{ restart: [], remove: [] }>()

// Same values as the card border and corner in the design tokens (--border-card, --radius-card).
const BAND = 16
const RADIUS = 64

/** The painted picture once there is one (its stored time versions the URL), the empty art before. */
const picture = computed(() => (props.item.thumbnail === null
  ? `/api/coloring/arts/${props.item.id}/preview.svg`
  : `/api/coloring/arts/${props.item.id}/thumbnail?v=${props.item.thumbnail}`))

const canRestart = computed(() => props.item.attempt > 0)
const canRemove = computed(() => props.item.source === 'user')
const hasActions = computed(() => canRestart.value || canRemove.value)

const label = computed(() => (props.item.percent > 0 ? `${props.item.title}, закрашено ${props.item.percent}%` : props.item.title))

const menuOpen = ref(false)
const root = ref<HTMLElement>()

function close() {
  menuOpen.value = false
}

function choose(action: 'restart' | 'remove') {
  close()
  if (action === 'restart') emit('restart')
  else emit('remove')
}

// A tap outside the menu or Escape closes it.
function onPointerDown(event: PointerEvent) {
  if (menuOpen.value && root.value && !root.value.contains(event.target as Node)) close()
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
</script>

<template>
  <article
    ref="root"
    class="gallery-card"
    @keydown.esc="close"
  >
    <NuxtLink
      class="gallery-card__link"
      :to="{ name: ColoringRoutes.EDITOR, params: { artId: item.id } }"
      :aria-label="label"
    >
      <img
        class="gallery-card__art"
        :src="picture"
        alt=""
        loading="lazy"
        decoding="async"
      >
    </NuxtLink>
    <GalleryProgressFrame
      :percent="item.percent"
      :band="BAND"
      :radius="RADIUS"
    />

    <template v-if="hasActions">
      <button
        class="gallery-card__more"
        type="button"
        aria-label="Действия с рисунком"
        :aria-expanded="menuOpen"
        @click="menuOpen = !menuOpen"
      >
        <span aria-hidden="true">⋯</span>
      </button>
      <div
        v-if="menuOpen"
        class="gallery-card__menu"
      >
        <button
          v-if="canRestart"
          class="gallery-card__action"
          type="button"
          @click="choose('restart')"
        >
          Начать заново
        </button>
        <button
          v-if="canRemove"
          class="gallery-card__action gallery-card__action--danger"
          type="button"
          @click="choose('remove')"
        >
          Удалить
        </button>
      </div>
    </template>
  </article>
</template>

<style scoped lang="scss">
// Figma "Coloring — Gallery": a white tile in a 16px pale frame, 64px corners, art centred.
.gallery-card {
  position: relative;
  height: var(--card-height);
  padding: var(--border-card);
  border-radius: var(--radius-card);
  background: var(--color-card-frame);
}

.gallery-card__link {
  display: grid;

  // A definite track: otherwise the image sizes the track by its width and overflows the tile.
  grid-template: minmax(0, 1fr) / minmax(0, 1fr);
  height: 100%;
  place-items: center;
  overflow: hidden;
  border-radius: calc(var(--radius-card) - var(--border-card));
  background: var(--color-surface);
}

.gallery-card__art {
  padding: var(--space-2);
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.gallery-card__more {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 50%;
  background: var(--color-progress);
  color: var(--color-on-overlay);
  font-size: var(--font-size-l);
  line-height: 1;
  cursor: pointer;
}

.gallery-card__menu {
  position: absolute;
  top: calc(var(--space-2) + 44px);
  right: var(--space-2);
  z-index: 1;
  display: flex;
  flex-direction: column;
  min-width: 160px;
  overflow: hidden;
  border-radius: var(--radius-m);
  background: var(--color-surface);
  box-shadow: 0 4px 16px rgb(35 38 47 / 20%);
}

.gallery-card__action {
  min-height: 44px;
  padding: 0 var(--space-4);
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: var(--color-bg);
  }
}

.gallery-card__action--danger {
  color: var(--color-danger);
}
</style>
