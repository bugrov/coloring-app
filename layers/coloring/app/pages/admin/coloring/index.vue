<script setup lang="ts">
import { ColoringRoutes } from '../../../../shared/routes'

definePageMeta({ name: ColoringRoutes.ADMIN_ARTS, auth: 'admin' })
useHead({ title: 'Рисунки: администратор', meta: [{ name: 'robots', content: 'noindex' }] })

const { arts, pending, loadError, uploading, uploadError, upload } = useAdminArts()

const STATUS_LABELS = { draft: 'Черновик', published: 'Опубликован', hidden: 'Скрыт' } as const

async function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const id = await upload(file)
  if (id) await navigateTo({ name: ColoringRoutes.ADMIN_ART, params: { artId: id } })
}
</script>

<template>
  <AdminPage title="Раскраска: рисунки">
    <template #nav>
      <AdminNav />
    </template>

    <section
      class="arts"
      aria-labelledby="arts-heading"
    >
      <div class="arts__toolbar">
        <h2
          id="arts-heading"
          class="arts__heading"
        >
          Встроенные и загруженные
        </h2>
        <label class="button button--primary arts__upload">
          {{ uploading ? 'Загружаем…' : 'Загрузить SVG' }}
          <input
            class="arts__file"
            type="file"
            accept=".svg,image/svg+xml"
            :disabled="uploading"
            @change="onPick"
          >
        </label>
      </div>
      <p
        v-if="uploadError"
        class="arts__error"
        role="alert"
      >
        {{ uploadError }}
      </p>
      <p
        v-if="loadError"
        class="arts__error"
        role="alert"
      >
        {{ loadError }}
      </p>
      <p
        v-else-if="pending && arts.length === 0"
        class="arts__note"
      >
        Загружаем…
      </p>

      <ul class="arts__list">
        <li
          v-for="art in arts"
          :key="art.id"
          class="arts__item"
        >
          <NuxtLink
            class="arts__title"
            :to="{ name: ColoringRoutes.ADMIN_ART, params: { artId: art.id } }"
          >
            {{ art.title }}
          </NuxtLink>
          <span
            class="arts__status"
            :class="`arts__status--${art.status}`"
          >{{ STATUS_LABELS[art.status] }}</span>
          <span class="arts__source">{{ art.source === 'admin' ? 'загружен' : 'встроенный' }}</span>
          <span class="arts__counts">открытий {{ art.opens }} · начали {{ art.starts }} · закончили {{ art.completes }}</span>
          <span
            v-if="art.assignedCountries.length + art.assignedPlayers.length > 0"
            class="arts__counts"
          >только для: стран {{ art.assignedCountries.length }}, игроков {{ art.assignedPlayers.length }}</span>
        </li>
      </ul>
    </section>
  </AdminPage>
</template>

<style scoped lang="scss">
.arts__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.arts__heading {
  margin: 0;
  font-size: var(--font-size-m);
}

.arts__upload {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.arts__file {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.arts__error {
  margin: 0 0 var(--space-3);
  color: var(--color-danger);
}

.arts__note {
  color: var(--color-text-muted);
}

.arts__list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.arts__item {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2) var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-m);
  background: var(--color-surface);
}

.arts__title {
  font-weight: 600;
}

.arts__status {
  padding: 2px var(--space-2);
  border-radius: var(--radius-m);
  background: var(--color-bg);
  font-size: var(--font-size-s);
}

.arts__status--published {
  background: var(--color-accent);
}

.arts__source,
.arts__counts {
  color: var(--color-text-muted);
  font-size: var(--font-size-s);
}
</style>
