<script setup lang="ts">
import { CoreRoutes } from '../../shared/routes'

definePageMeta({ name: CoreRoutes.HOME })

const games = useGames()
const { user } = useUserSession()
const signOut = useSignOut()
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
        v-for="game in games"
        :key="game.id"
      >
        <NuxtLink
          class="hub__link"
          :to="{ name: game.entry }"
        >
          {{ game.title }}
        </NuxtLink>
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
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.hub__link {
  display: block;
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-m);
  background: var(--color-surface);
  color: inherit;
  text-decoration: none;
  transition: transform var(--duration-fast) var(--ease-out);

  &:active {
    transform: scale(0.96);
  }
}
</style>
