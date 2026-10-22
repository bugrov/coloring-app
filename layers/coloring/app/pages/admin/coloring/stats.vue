<script setup lang="ts">
import { DEFAULT_STATS_DAYS } from '../../../../shared/admin'
import { ColoringRoutes } from '../../../../shared/routes'

definePageMeta({ name: ColoringRoutes.ADMIN_STATS, auth: 'admin' })
useHead({ title: 'Статистика: администратор', meta: [{ name: 'robots', content: 'noindex' }] })

const PERIODS = [7, 30, 90] as const
const days = ref<number>(DEFAULT_STATS_DAYS)
const { stats, pending, loadError } = useAdminStats(days)

const funnel = computed(() => [
  { label: 'Открыли', value: stats.value?.totals.opens ?? 0 },
  { label: 'Начали рисовать', value: stats.value?.totals.starts ?? 0 },
  { label: 'Закончили', value: stats.value?.totals.completes ?? 0 },
  { label: 'Начали заново', value: stats.value?.totals.restarts ?? 0 },
])
const popular = computed(() => (stats.value?.arts ?? []).map(art => ({ label: art.title, value: art.opens })))
const byCountry = computed(() => (stats.value?.countries ?? []).map(entry => ({ label: countryName(entry.country), value: entry.opens })))
</script>

<template>
  <AdminPage title="Раскраска: статистика">
    <template #nav>
      <AdminNav />
    </template>

    <div class="stats">
      <div
        class="stats__periods"
        role="group"
        aria-label="Период"
      >
        <button
          v-for="period in PERIODS"
          :key="period"
          class="button stats__period"
          :class="{ 'stats__period--active': period === days }"
          type="button"
          :aria-pressed="period === days"
          @click="days = period"
        >
          {{ period }} дней
        </button>
      </div>

      <p
        v-if="loadError"
        class="stats__error"
        role="alert"
      >
        {{ loadError }}
      </p>
      <p
        v-else-if="pending && !stats"
        class="stats__note"
      >
        Загружаем…
      </p>

      <template v-if="stats">
        <p class="stats__players">
          Игроков за период: <strong>{{ stats.totals.players }}</strong>
        </p>
        <div class="stats__grid">
          <section class="admin-card">
            <AdminBars
              title="Воронка"
              unit="раз"
              :items="funnel"
            />
          </section>
          <section class="admin-card stats__card--wide">
            <AdminLineChart :days="stats.daily" />
          </section>
          <section class="admin-card">
            <AdminBars
              title="Популярные рисунки (открытия)"
              unit="открытий"
              :items="popular"
            />
          </section>
          <section class="admin-card">
            <AdminBars
              title="Страны (открытия)"
              unit="открытий"
              :items="byCountry"
            />
          </section>
        </div>
      </template>
    </div>
  </AdminPage>
</template>

<style scoped lang="scss">
.stats {
  display: grid;
  gap: var(--space-3);
}

.stats__periods {
  display: flex;
  gap: var(--space-2);
}

.stats__period {
  background: var(--color-bg);
}

.stats__period--active {
  background: var(--color-accent);
}

.stats__error {
  margin: 0;
  color: var(--color-danger);
}

.stats__note,
.stats__players {
  margin: 0;
  color: var(--color-text-muted);
}

.stats__grid {
  display: grid;
  gap: var(--space-4);
}

@media (min-width: 900px) {
  .stats__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stats__card--wide {
    grid-column: 1 / -1;
  }
}
</style>
