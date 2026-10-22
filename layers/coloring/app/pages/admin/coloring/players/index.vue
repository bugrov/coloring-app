<script setup lang="ts">
import { ColoringRoutes } from '../../../../../shared/routes'

definePageMeta({ name: ColoringRoutes.ADMIN_PLAYERS, auth: 'admin' })
useHead({ title: 'Игроки: администратор', meta: [{ name: 'robots', content: 'noindex' }] })

const { query, found, selected, arts, error, searched, search, select } = useAdminPlayers()
const when = (iso: string) => new Date(iso).toLocaleString('ru')
</script>

<template>
  <AdminPage title="Раскраска: игроки">
    <template #nav>
      <AdminNav />
    </template>

    <div class="players">
      <form
        class="players__search"
        @submit.prevent="search"
      >
        <label
          class="players__label"
          for="players-query"
        >Имя игрока</label>
        <input
          id="players-query"
          v-model="query"
          class="form-input form-input--on-surface players__input"
          type="search"
          placeholder="Начало имени"
          autocomplete="off"
        >
        <button
          class="button button--primary"
          type="submit"
        >
          Найти
        </button>
      </form>

      <p
        v-if="error"
        class="players__error"
        role="alert"
      >
        {{ error }}
      </p>
      <p
        v-else-if="searched && found.length === 0"
        class="players__note"
      >
        Никого не нашли.
      </p>

      <ul
        v-if="found.length > 0"
        class="players__found"
        aria-label="Найденные игроки"
      >
        <li
          v-for="player in found"
          :key="player.id"
        >
          <button
            class="players__pick"
            :class="{ 'players__pick--active': selected?.id === player.id }"
            type="button"
            @click="select(player)"
          >
            {{ player.username }} ({{ countryName(player.country) }})
          </button>
        </li>
      </ul>

      <section
        v-if="selected"
        class="players__arts"
        :aria-label="`Рисунки игрока ${selected.username}`"
      >
        <h2 class="players__heading">
          {{ selected.username }}
        </h2>
        <p
          v-if="arts.length === 0"
          class="players__note"
        >
          Игрок ещё ничего не начинал.
        </p>
        <article
          v-for="art in arts"
          :key="art.artId"
          class="admin-card players__art"
        >
          <h3 class="players__art-title">
            {{ art.title }}
          </h3>
          <ul class="players__attempts">
            <li
              v-for="entry in art.attempts"
              :key="entry.attempt"
            >
              <NuxtLink
                class="players__attempt"
                :to="{ name: ColoringRoutes.ADMIN_PLAYER_ART, params: { playerId: selected.id, artId: art.artId }, query: { attempt: entry.attempt } }"
              >
                Попытка {{ entry.attempt }}: {{ entry.percent }} %, шагов {{ entry.steps }}, {{ when(entry.updatedAt) }}
              </NuxtLink>
            </li>
          </ul>
        </article>
      </section>
    </div>
  </AdminPage>
</template>

<style scoped lang="scss">
.players {
  display: grid;
  gap: var(--space-3);
}

.players__search {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.players__label {
  font-weight: 600;
}

.players__error {
  margin: 0;
  color: var(--color-danger);
}

.players__note {
  margin: 0;
  color: var(--color-text-muted);
}

.players__found {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.players__pick {
  min-height: 44px;
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-m);
  background: var(--color-surface);
  font: inherit;
  cursor: pointer;
}

.players__pick--active {
  background: var(--color-accent);
}

.players__pick:focus-visible {
  @include focus-ring;
}

.players__arts {
  display: grid;
  gap: var(--space-3);
}

.players__heading {
  margin: 0;
  font-size: var(--font-size-m);
}

.players__input {
  flex: 1;
  width: auto;
  min-width: 180px;
}

.players__art-title {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-m);
}

.players__attempts {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.players__attempt {
  display: block;
  padding: var(--space-2) 0;
}
</style>
