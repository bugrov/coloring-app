<script setup lang="ts">
import { readApiError } from '#layers/core/shared/errors'
import type { AdminPlayer } from '../../../shared'

const props = defineProps<{
  countries: string[]
  players: AdminPlayer[]
  busy: boolean
}>()

const emit = defineEmits<{ save: [countries: string[], players: string[]] }>()

const api = useRequestFetch()
const options = countryOptions()
const names = new Intl.DisplayNames('ru', { type: 'region' })

const chosenCountries = ref<string[]>([...props.countries])
const chosenPlayers = ref<AdminPlayer[]>([...props.players])
watch(() => props.countries, value => (chosenCountries.value = [...value]))
watch(() => props.players, value => (chosenPlayers.value = [...value]))

const pickedCountry = ref('')
function addCountry() {
  if (pickedCountry.value && !chosenCountries.value.includes(pickedCountry.value)) chosenCountries.value.push(pickedCountry.value)
  pickedCountry.value = ''
}

const query = ref('')
const found = ref<AdminPlayer[]>([])
const searchError = ref('')

async function search() {
  searchError.value = ''
  if (!query.value.trim()) return
  try {
    found.value = await api<AdminPlayer[]>('/api/admin/coloring/players', { query: { query: query.value.trim() } })
  }
  catch (failure) {
    searchError.value = readApiError(failure).message
  }
}

function addPlayer(player: AdminPlayer) {
  if (!chosenPlayers.value.some(entry => entry.id === player.id)) chosenPlayers.value.push(player)
}

const everyone = computed(() => chosenCountries.value.length === 0 && chosenPlayers.value.length === 0)
</script>

<template>
  <section
    class="assign"
    aria-labelledby="assign-heading"
  >
    <h2
      id="assign-heading"
      class="assign__heading"
    >
      Кому показывать
    </h2>
    <p class="assign__hint">
      {{ everyone ? 'Сейчас рисунок виден всем игрокам.' : 'Рисунок виден только выбранным странам и игрокам.' }}
    </p>

    <div class="assign__row">
      <label
        class="assign__label"
        for="assign-country"
      >Страна</label>
      <select
        id="assign-country"
        v-model="pickedCountry"
        class="assign__input"
        @change="addCountry"
      >
        <option value="">
          Добавить страну…
        </option>
        <option
          v-for="option in options"
          :key="option.code"
          :value="option.code"
        >
          {{ option.name }}
        </option>
      </select>
    </div>
    <ul
      class="assign__chips"
      aria-label="Выбранные страны"
    >
      <li
        v-for="code in chosenCountries"
        :key="code"
        class="assign__chip"
      >
        {{ names.of(code) ?? code }}
        <button
          class="assign__remove"
          type="button"
          :aria-label="`Убрать страну ${names.of(code) ?? code}`"
          @click="chosenCountries = chosenCountries.filter(entry => entry !== code)"
        >
          ×
        </button>
      </li>
    </ul>

    <form
      class="assign__row"
      @submit.prevent="search"
    >
      <label
        class="assign__label"
        for="assign-player"
      >Игрок</label>
      <input
        id="assign-player"
        v-model="query"
        class="assign__input"
        type="search"
        placeholder="Начало имени"
        autocomplete="off"
      >
      <button
        class="button button--ghost"
        type="submit"
      >
        Найти
      </button>
    </form>
    <p
      v-if="searchError"
      class="assign__error"
      role="alert"
    >
      {{ searchError }}
    </p>
    <ul
      v-if="found.length > 0"
      class="assign__found"
      aria-label="Найденные игроки"
    >
      <li
        v-for="player in found"
        :key="player.id"
      >
        <button
          class="assign__pick"
          type="button"
          @click="addPlayer(player)"
        >
          {{ player.username }} ({{ names.of(player.country) ?? player.country }})
        </button>
      </li>
    </ul>
    <ul
      class="assign__chips"
      aria-label="Выбранные игроки"
    >
      <li
        v-for="player in chosenPlayers"
        :key="player.id"
        class="assign__chip"
      >
        {{ player.username }} ({{ player.country }})
        <button
          class="assign__remove"
          type="button"
          :aria-label="`Убрать игрока ${player.username}`"
          @click="chosenPlayers = chosenPlayers.filter(entry => entry.id !== player.id)"
        >
          ×
        </button>
      </li>
    </ul>

    <button
      class="button button--primary"
      type="button"
      :disabled="busy"
      @click="emit('save', chosenCountries, chosenPlayers.map(player => player.id))"
    >
      Сохранить назначение
    </button>
  </section>
</template>

<style scoped lang="scss">
.assign {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-m);
  background: var(--color-surface);
}

.assign__heading {
  margin: 0;
  font-size: var(--font-size-m);
}

.assign__hint {
  margin: 0;
  color: var(--color-text-muted);
}

.assign__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.assign__label {
  min-width: 6ch;
  font-weight: 600;
}

.assign__input {
  flex: 1;
  min-width: 160px;
  min-height: 44px;
  padding: 0 var(--space-3);
  border: 2px solid var(--color-bg);
  border-radius: var(--radius-m);
  background: var(--color-surface);
  font: inherit;
}

.assign__input:focus-visible {
  border-color: var(--color-accent);
  outline: none;
}

.assign__chips,
.assign__found {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.assign__chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 2px var(--space-3);
  border-radius: var(--radius-m);
  background: var(--color-bg);
}

.assign__remove,
.assign__pick {
  min-height: 32px;
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--radius-m);
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.assign__pick {
  background: var(--color-bg);
}

.assign__remove:focus-visible,
.assign__pick:focus-visible {
  @include focus-ring;
}

.assign__error {
  margin: 0;
  color: var(--color-danger);
}
</style>
