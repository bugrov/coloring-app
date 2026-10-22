<script setup lang="ts">
import type { AdminPlayer } from '../../../shared'

const props = defineProps<{
  countries: string[]
  players: AdminPlayer[]
  busy: boolean
}>()

const emit = defineEmits<{ save: [countries: string[], players: string[]] }>()

const options = countryOptions()

const chosenCountries = ref<string[]>([...props.countries])
const chosenPlayers = ref<AdminPlayer[]>([...props.players])

watch(() => props.countries, value => (chosenCountries.value = [...value]))
watch(() => props.players, value => (chosenPlayers.value = [...value]))

const pickedCountry = ref('')

function addCountry() {
  if (pickedCountry.value && !chosenCountries.value.includes(pickedCountry.value)) chosenCountries.value.push(pickedCountry.value)
  pickedCountry.value = ''
}

const { query, found, error: searchError, search } = usePlayerSearch()

function addPlayer(player: AdminPlayer) {
  if (!chosenPlayers.value.some(entry => entry.id === player.id)) chosenPlayers.value.push(player)
}

const everyone = computed(() => chosenCountries.value.length === 0 && chosenPlayers.value.length === 0)
</script>

<template>
  <section
    class="admin-card"
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
      <FormSelect
        id="assign-country"
        v-model="pickedCountry"
        on-surface
        class="assign__input"
        @change="addCountry"
      >
        <FormOption value="">
          Добавить страну…
        </FormOption>
        <FormOption
          v-for="option in options"
          :key="option.code"
          :value="option.code"
        >
          {{ option.name }}
        </FormOption>
      </FormSelect>
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
        {{ countryName(code) }}
        <button
          class="assign__remove"
          type="button"
          :aria-label="`Убрать страну ${countryName(code)}`"
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
      <FormInput
        id="assign-player"
        v-model="query"
        on-surface
        class="assign__input"
        type="search"
        placeholder="Начало имени"
        autocomplete="off"
      />
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
          {{ player.username }} ({{ countryName(player.country) }})
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
  width: auto;
  min-width: 160px;
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
