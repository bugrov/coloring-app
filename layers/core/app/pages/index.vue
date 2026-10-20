<script setup lang="ts">
const games = useGames()
</script>

<template>
  <SafeAreaPage>
    <h1 class="hub__title">
      Игры
    </h1>
    <ul class="hub__list">
      <li
        v-for="game in games"
        :key="game.id"
      >
        <NuxtLink
          class="hub__link"
          :to="game.entry"
        >
          {{ game.title }}
        </NuxtLink>
      </li>
    </ul>
  </SafeAreaPage>
</template>

<style scoped lang="scss">
.hub__title {
  margin: 0;
  font-size: var(--font-size-l);
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
