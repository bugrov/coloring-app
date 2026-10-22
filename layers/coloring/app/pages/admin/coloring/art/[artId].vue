<script setup lang="ts">
import { ColoringRoutes } from '../../../../../shared/routes'

definePageMeta({ name: ColoringRoutes.ADMIN_ART, auth: 'admin' })
useHead({ title: 'Рисунок: администратор', meta: [{ name: 'robots', content: 'noindex' }] })

const route = useRoute()
const artId = computed(() => String(route.params.artId))
const { details, summary, loadError, notice, busy, rename, setStatus, assign, remove } = useAdminArt(artId)

const STATUS_LABELS = { draft: 'Черновик', published: 'Опубликован', hidden: 'Скрыт' } as const

const title = ref('')
watch(details, (value) => {
  if (value) title.value = value.title
}, { immediate: true })

const confirmDelete = ref(false)
async function onDelete() {
  confirmDelete.value = false
  if (await remove()) await navigateTo({ name: ColoringRoutes.ADMIN_ARTS })
}
</script>

<template>
  <AdminPage :title="details?.title ?? 'Рисунок'">
    <template #nav>
      <AdminNav />
    </template>

    <p
      v-if="loadError"
      class="art__error"
      role="alert"
    >
      {{ loadError }}
    </p>

    <div
      v-else-if="details"
      class="art"
    >
      <section
        class="art__preview"
        aria-label="Как выглядит рисунок"
      >
        <ArtPreview
          class="art__svg"
          :art="details.art"
        />
        <p class="art__hint">
          Так игрок увидит рисунок.
        </p>
      </section>

      <div class="art__side">
        <form
          v-if="details.source === 'admin'"
          class="art__card"
          @submit.prevent="rename(title)"
        >
          <label
            class="art__label"
            for="art-title"
          >Название</label>
          <input
            id="art-title"
            v-model="title"
            class="art__input"
            maxlength="60"
            required
          >
          <button
            class="button button--ghost"
            type="submit"
            :disabled="busy || title.trim() === details.title"
          >
            Переименовать
          </button>
        </form>

        <section
          class="art__card"
          aria-labelledby="art-status"
        >
          <h2
            id="art-status"
            class="art__heading"
          >
            Статус: {{ STATUS_LABELS[details.status] }}
          </h2>
          <p
            v-if="summary"
            class="art__hint"
          >
            Открытий {{ summary.opens }}, начали {{ summary.starts }}, закончили {{ summary.completes }}.
          </p>
          <div class="art__actions">
            <button
              v-if="details.status !== 'published'"
              class="button button--primary"
              type="button"
              :disabled="busy"
              @click="setStatus('published')"
            >
              Опубликовать
            </button>
            <button
              v-if="details.status === 'published'"
              class="button button--ghost"
              type="button"
              :disabled="busy"
              @click="setStatus('hidden')"
            >
              Скрыть
            </button>
            <button
              v-if="details.source === 'admin' && details.status !== 'draft'"
              class="button button--ghost"
              type="button"
              :disabled="busy"
              @click="setStatus('draft')"
            >
              В черновик
            </button>
            <button
              v-if="details.source === 'admin'"
              class="button button--ghost art__danger"
              type="button"
              :disabled="busy"
              @click="confirmDelete = true"
            >
              Удалить
            </button>
          </div>
          <p
            v-if="details.source === 'builtin'"
            class="art__hint"
          >
            Встроенный рисунок нельзя удалить, только скрыть.
          </p>
        </section>

        <AdminAssignments
          v-if="summary"
          :countries="summary.assignedCountries"
          :players="summary.assignedPlayers"
          :busy="busy"
          @save="assign"
        />

        <p
          v-if="notice"
          class="art__error"
          role="alert"
        >
          {{ notice }}
        </p>
      </div>
    </div>

    <ConfirmDialog
      :open="confirmDelete"
      title="Удалить рисунок?"
      text="Рисунок, попытки игроков и статистика по нему пропадут насовсем."
      confirm-label="Удалить"
      danger
      @confirm="onDelete"
      @cancel="confirmDelete = false"
    />
  </AdminPage>
</template>

<style scoped lang="scss">
.art {
  display: grid;
  gap: var(--space-4);
}

.art__preview {
  padding: var(--space-4);
  border-radius: var(--radius-m);
  background: var(--color-surface);
}

.art__svg {
  display: block;
  width: 100%;
  max-height: 60dvh;
  background: var(--color-surface);
}

.art__side {
  display: grid;
  align-content: start;
  gap: var(--space-4);
}

.art__card {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-m);
  background: var(--color-surface);
}

.art__label {
  font-weight: 600;
}

.art__heading {
  margin: 0;
  font-size: var(--font-size-m);
}

.art__input {
  min-height: 44px;
  padding: 0 var(--space-3);
  border: 2px solid var(--color-bg);
  border-radius: var(--radius-m);
  background: var(--color-surface);
  font: inherit;
}

.art__input:focus-visible {
  border-color: var(--color-accent);
  outline: none;
}

.art__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.art__danger {
  color: var(--color-danger);
}

.art__hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-s);
}

.art__error {
  margin: 0;
  color: var(--color-danger);
}

@media (min-width: 900px) {
  .art {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}
</style>
