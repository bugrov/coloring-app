<script setup lang="ts">
import { ColoringRoutes } from '../../../shared/routes'

const LINKS = [
  { name: ColoringRoutes.ADMIN_ARTS, label: 'Рисунки' },
  { name: ColoringRoutes.ADMIN_STATS, label: 'Статистика' },
  { name: ColoringRoutes.ADMIN_PLAYERS, label: 'Игроки' },
  { name: ColoringRoutes.ADMIN_PALETTE, label: 'Палитра' },
  { name: ColoringRoutes.ADMIN_SETTINGS, label: 'Настройки' },
]
</script>

<template>
  <nav
    class="admin-nav"
    aria-label="Разделы раскраски"
  >
    <NuxtLink
      v-for="link in LINKS"
      :key="link.name"
      class="admin-nav__link"
      active-class="admin-nav__link--active"
      :to="{ name: link.name }"
    >
      {{ link.label }}
    </NuxtLink>
  </nav>
</template>

<style scoped lang="scss">
.admin-nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.admin-nav__link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-m);
  background: var(--color-bg);
  color: var(--color-text);
  font-weight: 600;
  text-decoration: none;
}

.admin-nav__link--active {
  background: var(--color-accent);
}

.admin-nav__link:focus-visible {
  @include focus-ring;
}
</style>
