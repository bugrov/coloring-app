<script setup lang="ts">
import { CoreRoutes } from '../../shared/routes'

definePageMeta({ name: CoreRoutes.HOME })

/** The pictures of the first games are fetched at once (and announced in the head); the rest wait until they are near the screen. */
const PRIORITY_GAMES = 2

const games = useGames()
const { user } = useUserSession()
const signOut = useSignOut()

useHead({
  link: games.value
    .slice(0, PRIORITY_GAMES)
    .flatMap(game => (game.cover ? [{ rel: 'preload', as: 'image', href: game.cover, fetchpriority: 'high' as const }] : [])),
})
</script>

<template>
  <SafeAreaPage>
    <header class="hub__header">
      <h1 class="hub__title">
        Игры
      </h1>
      <p class="hub__user">
        {{ user?.username }}
      </p>
      <button
        class="button button--ghost"
        type="button"
        @click="signOut"
      >
        Выйти
      </button>
    </header>
    <ul class="hub__list">
      <li
        v-for="(game, index) in games"
        :key="game.id"
      >
        <GameCard
          :game="game"
          :priority="index < PRIORITY_GAMES"
        />
      </li>
    </ul>
  </SafeAreaPage>
</template>

<style scoped lang="scss">
.hub__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.hub__title {
  margin: 0;
  font-size: var(--font-size-l);
}

.hub__user {
  margin: 0 0 0 auto;
  color: var(--color-text-muted);
}

.hub__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 540px));
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
