<script setup lang="ts">
import { CoreRoutes } from '#layers/core/shared/routes'
import { ColoringRoutes } from '../../../shared/routes'

definePageMeta({ name: ColoringRoutes.GALLERY })
</script>

<template>
  <SafeAreaPage>
    <h1 class="coloring-gallery__title">
      Раскраска
    </h1>
    <p class="coloring-gallery__note">
      Галерея появится на шаге 5.
    </p>
    <NuxtLink :to="{ name: CoreRoutes.HOME }">
      ← К играм
    </NuxtLink>
  </SafeAreaPage>
</template>

<style scoped lang="scss">
.coloring-gallery__title {
  margin: 0;
  font-size: var(--font-size-l);
}

.coloring-gallery__note {
  margin: 0;
  color: var(--color-text-muted);
}
</style>
