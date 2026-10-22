<script setup lang="ts">
import { ColoringRoutes } from '../../../shared/routes'
import type { GalleryItem } from '../../../shared'

const props = defineProps<{
  item: GalleryItem
  /** A card in the first row: its picture is fetched at once, the others wait until they are near the screen. */
  priority?: boolean
}>()
const emit = defineEmits<{ restart: [], remove: [] }>()

// Same values as the card border and corner in the design tokens (--border-card, --radius-card).
const BAND = 16
const RADIUS = 64

/**
 * What the card shows, best first: the painted picture once there is one (its stored time versions
 * the URL), then the empty art, then a plain placeholder when neither could be loaded.
 */
type Picture = 'thumbnail' | 'preview' | 'none'

const picture = ref<Picture>(props.item.thumbnail === null ? 'preview' : 'thumbnail')
const loaded = ref(false)
const image = useTemplateRef<HTMLImageElement>('image')

const pictureUrl = computed(() => (picture.value === 'thumbnail'
  ? `/api/coloring/arts/${props.item.id}/thumbnail?v=${props.item.thumbnail}`
  : `/api/coloring/arts/${props.item.id}/preview.svg`))

// A new painted picture (the player drew, or started over) is a new image to wait for.
watch(() => props.item.thumbnail, (value) => {
  picture.value = value === null ? 'preview' : 'thumbnail'
  loaded.value = false
})

function onError() {
  loaded.value = false
  picture.value = picture.value === 'thumbnail' ? 'preview' : 'none'
}

// The server-rendered image may be in the cache and loaded before the page woke up: no `load` event then.
onMounted(() => {
  if (image.value?.complete && image.value.naturalWidth > 0) loaded.value = true
})

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
        v-if="picture !== 'none'"
        :key="picture"
        ref="image"
        class="gallery-card__art"
        :class="{ 'gallery-card__art--loaded': loaded }"
        :src="pictureUrl"
        alt=""
        :loading="priority ? 'eager' : 'lazy'"
        :fetchpriority="priority ? 'high' : 'auto'"
        decoding="async"
        @load="loaded = true"
        @error="onError"
      >
      <svg
        v-else
        class="gallery-card__missing"
        viewBox="0 0 24 24"
        width="48"
        height="48"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <rect
          x="3"
          y="4"
          width="18"
          height="16"
          rx="3"
        />
        <circle
          cx="9"
          cy="10"
          r="1.5"
        />
        <path d="m4 18 5-5 4 4 3-3 4 4" />
      </svg>
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

  // The tile is a calm pale colour until the picture is there, then the picture fades in: cards that
  // arrive one by one do not pop in.
  opacity: 0;
  transition: opacity var(--duration-base) var(--ease-out);
}

.gallery-card__art--loaded {
  opacity: 1;
}

.gallery-card__missing {
  color: var(--color-text-muted);
  opacity: 0.5;
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
