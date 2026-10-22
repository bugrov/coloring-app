<script setup lang="ts">
import { CoreRoutes } from '../../../shared/routes'

definePageMeta({ name: CoreRoutes.ADMIN, auth: 'admin' })

const { user } = useUserSession()
const signOut = useSignOut(CoreRoutes.ADMIN_LOGIN)
const games = useGames()
</script>

<template>
  <SafeAreaPage>
    <h1 class="admin__title">
      Администратор
    </h1>
    <p class="admin__note">
      {{ user?.username }}
    </p>
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
          class="button button--primary admin__game"
          :to="{ name: game.adminEntry }"
        >
          {{ game.title }}: управление
        </NuxtLink>
      </template>
    </nav>
    <button
      class="button button--ghost admin__sign-out"
      type="button"
      @click="signOut"
    >
      Выйти
    </button>
  </SafeAreaPage>
</template>

<style scoped lang="scss">
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
  gap: var(--space-3);
}

.admin__sign-out {
  align-self: flex-start;
}
</style>
