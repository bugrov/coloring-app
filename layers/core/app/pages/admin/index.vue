<script setup lang="ts">
import { CoreRoutes } from '../../../shared/routes'

definePageMeta({ name: CoreRoutes.ADMIN, auth: 'admin' })

const { user } = useUserSession()
const signOut = useSignOut(CoreRoutes.ADMIN_LOGIN)
const games = useGames()
</script>

<template>
  <SafeAreaPage>
    <header class="admin__header">
      <h1 class="admin__title">
        Администратор
      </h1>
      <p class="admin__note">
        {{ user?.username }}
      </p>
    </header>
    <nav
      class="admin__games"
      aria-label="Игры"
    >
      <template
        v-for="game in games"
        :key="game.id"
      >
        <NuxtLink
          v-if="game.adminEntry"
          class="admin__tile"
          :to="{ name: game.adminEntry }"
        >
          <span class="admin__tile-title">{{ game.title }}</span>
          <span class="admin__tile-note">Управление</span>
        </NuxtLink>
      </template>
    </nav>
    <button
      class="button button--danger admin__sign-out"
      type="button"
      @click="signOut"
    >
      Выйти
    </button>
  </SafeAreaPage>
</template>

<style scoped lang="scss">
.admin__header {
  display: grid;
  gap: var(--space-1);
}

.admin__title {
  margin: 0;
  font-size: var(--font-size-l);
}

.admin__note {
  margin: 0;
  color: var(--color-text-muted);
}

.admin__games {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
}

// A game as a card, like the ones in the gallery: easy to hit and to tell apart.
.admin__tile {
  display: grid;
  align-content: end;
  gap: var(--space-1);
  width: 180px;
  height: 140px;
  padding: var(--space-4);
  border-radius: var(--radius-l);
  background: var(--color-accent);
  box-shadow: 0 4px 16px rgb(35 38 47 / 15%);
  transition: transform var(--duration-fast) var(--ease-out);
}

.admin__tile:active {
  transform: scale(0.97);
}

.admin__tile:focus-visible {
  @include focus-ring;
}

.admin__tile-title {
  font-size: var(--font-size-l);
  font-weight: 700;
}

.admin__tile-note {
  font-size: var(--font-size-s);
  opacity: 0.75;
}

.admin__sign-out {
  align-self: flex-start;
}
</style>
