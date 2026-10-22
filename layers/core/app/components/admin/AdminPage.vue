<script setup lang="ts">
import { CoreRoutes } from '../../../shared/routes'

defineProps<{
  title: string
}>()
</script>

<template>
  <SafeAreaPage>
    <header class="admin-page__header">
      <NuxtLink
        class="admin-page__home"
        :to="{ name: CoreRoutes.ADMIN }"
      >
        Администратор
      </NuxtLink>
      <h1 class="admin-page__title">
        {{ title }}
      </h1>
      <div class="admin-page__nav">
        <slot name="nav" />
      </div>
    </header>
    <div class="admin-page__body">
      <slot />
    </div>
  </SafeAreaPage>
</template>

<style scoped lang="scss">
// The game screens do not scroll; the administration does, inside its own box, under a fixed header.
.admin-page__header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2) var(--space-4);
}

.admin-page__home {
  color: var(--color-text-muted);
  font-size: var(--font-size-s);
}

.admin-page__title {
  margin: 0;
  font-size: var(--font-size-l);
}

.admin-page__nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-inline-start: auto;
}

.admin-page__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
</style>
