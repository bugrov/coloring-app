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
        aria-label="В начало админки"
        title="В начало админки"
      >
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M3 11 12 3l9 8" />
          <path d="M5 10v10h14V10" />
          <path d="M10 20v-5h4v5" />
        </svg>
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
// Mobile first: the sections sit on their own row under the title, from the left. On a wide screen
// they move up to the right of it.
.admin-page__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
}

.admin-page__home {
  display: inline-grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--color-surface);
}

.admin-page__home:focus-visible {
  @include focus-ring;
}

.admin-page__title {
  margin: 0;
  font-size: var(--font-size-l);
}

.admin-page__nav {
  flex-basis: 100%;
}

.admin-page__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

@media (min-width: 900px) {
  .admin-page__nav {
    flex-basis: auto;
    margin-inline-start: auto;
  }
}
</style>
