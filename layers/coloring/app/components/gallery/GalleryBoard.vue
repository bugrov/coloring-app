<script setup lang="ts">
import { CoreRoutes } from '#layers/core/shared/routes'
import type { GalleryItem } from '../../../shared'
import { useGalleryStore } from '../../stores/gallery'

const gallery = useGalleryStore()

/** The cards of the first row load their pictures at once; the rest wait until they are near the screen. */
const PRIORITY_CARDS = 6

/** Cards drawn as placeholders while the first page loads. */
const SKELETON_COUNT = 7

type Pending = { kind: 'restart' | 'remove', item: GalleryItem }
const pending = ref<Pending | null>(null)
const importing = ref(false)

const dialog = computed(() => {
  if (!pending.value) return { title: '', text: '', confirmLabel: '' }
  return pending.value.kind === 'remove'
    ? { title: 'Удалить рисунок?', text: 'Рисунок и вся раскраска пропадут насовсем.', confirmLabel: 'Удалить' }
    : { title: 'Начать заново?', text: 'Закрашенное сбросится, и рисунок начнётся с чистого листа.', confirmLabel: 'Начать заново' }
})

async function confirm() {
  const current = pending.value
  pending.value = null
  if (!current) return
  if (current.kind === 'remove') await gallery.remove(current.item.id)
  else await gallery.restart(current.item.id)
}

async function onPick(file: File) {
  importing.value = true
  try {
    await gallery.importSvg(file)
  }
  finally {
    importing.value = false
  }
}

// The next page loads when the end of the list scrolls into view.
const sentinel = ref<HTMLElement>()
const scroller = ref<HTMLElement>()
let observer: IntersectionObserver | undefined

onMounted(() => {
  observer = new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting) void gallery.loadMore()
  }, { root: scroller.value, rootMargin: '200px' })
  // The observer reports changes only: observing again after each load makes it report a
  // sentinel that is still in view, so a screen taller than the loaded cards keeps filling.
  watchEffect(() => {
    void gallery.items.length
    observer?.disconnect()
    if (sentinel.value) observer?.observe(sentinel.value)
  })
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div
    ref="scroller"
    class="gallery-board"
  >
    <nav class="gallery-board__nav">
      <NuxtLink
        class="gallery-board__back"
        :to="{ name: CoreRoutes.HOME }"
        aria-label="К играм"
      >
        <span aria-hidden="true">←</span>
      </NuxtLink>
    </nav>

    <p
      v-if="gallery.notice"
      class="gallery-board__notice"
      role="alert"
    >
      {{ gallery.notice }}
    </p>

    <div
      v-if="gallery.status === 'error'"
      class="gallery-board__state"
    >
      <p>{{ gallery.error }}</p>
      <button
        class="button button--primary"
        type="button"
        @click="gallery.loadFirst()"
      >
        Повторить
      </button>
    </div>

    <ul
      v-else
      class="gallery-board__grid"
      :aria-busy="gallery.status !== 'ready' || importing"
    >
      <li>
        <GalleryAddCard
          :busy="importing"
          @pick="onPick"
        />
      </li>
      <template v-if="gallery.status === 'ready'">
        <li
          v-for="(item, index) in gallery.items"
          :key="item.id"
        >
          <GalleryCard
            :item="item"
            :priority="index < PRIORITY_CARDS"
            @restart="pending = { kind: 'restart', item }"
            @remove="pending = { kind: 'remove', item }"
          />
        </li>
      </template>
      <template v-else>
        <li
          v-for="index in SKELETON_COUNT"
          :key="index"
          class="gallery-board__skeleton"
          aria-hidden="true"
        />
      </template>
    </ul>

    <p
      v-if="gallery.status === 'ready' && gallery.items.length === 0"
      class="gallery-board__state"
    >
      Пока нет рисунков. Добавьте свой с помощью плюса.
    </p>

    <div
      v-if="gallery.nextCursor"
      ref="sentinel"
      class="gallery-board__sentinel"
    >
      <span v-if="gallery.loadingMore">Загрузка…</span>
    </div>

    <!-- Fetched when the first confirmation is asked for, not with the page. -->
    <LazyConfirmDialog
      v-if="pending !== null"
      open
      :title="dialog.title"
      :text="dialog.text"
      :confirm-label="dialog.confirmLabel"
      :danger="pending?.kind === 'remove'"
      @confirm="confirm"
      @cancel="pending = null"
    />
  </div>
</template>

<style scoped lang="scss">
.gallery-board {
  height: 100%;
  overflow-y: auto;
  color: var(--color-text);
}

.gallery-board__nav {
  max-width: 1100px;
  margin: 0 auto var(--space-2);
}

.gallery-board__back {
  display: inline-grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-card-frame);
  color: var(--color-text);
  font-size: var(--font-size-l);
  text-decoration: none;
}

// Figma: 4 columns, 24px gaps, tiles 200px tall, the block at most 1100px wide and centred.
.gallery-board__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-gallery);
  max-width: 1100px;
  margin: 0 auto;
  padding: 0;
  list-style: none;

  @media (min-width: 640px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.gallery-board__skeleton {
  height: var(--card-height);
  border-radius: var(--radius-card);
  background: var(--color-card-frame);
  opacity: 0.5;
}

.gallery-board__state {
  display: grid;
  gap: var(--space-4);
  justify-items: center;
  max-width: 1100px;
  margin: var(--space-6) auto;
  text-align: center;
}

.gallery-board__notice {
  max-width: 1100px;
  margin: 0 auto var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-m);
  background: var(--color-surface);
  color: var(--color-danger);
}

.gallery-board__sentinel {
  min-height: 48px;
  padding: var(--space-4);
  text-align: center;
}
</style>
