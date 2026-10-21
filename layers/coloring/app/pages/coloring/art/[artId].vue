<script setup lang="ts">
import { CoreRoutes } from '#layers/core/shared/routes'
import { ColoringRoutes } from '../../../../shared/routes'

definePageMeta({ name: ColoringRoutes.EDITOR })
</script>

<template>
  <SafeAreaPage>
    <h1 class="coloring-editor__title">
      Редактор
    </h1>
    <p class="coloring-editor__note">
      Раскраска появится на шаге 6.
    </p>
    <NuxtLink :to="{ name: ColoringRoutes.GALLERY }">
      ← К галерее
    </NuxtLink>
    <NuxtLink :to="{ name: CoreRoutes.HOME }">
      ← К играм
    </NuxtLink>
  </SafeAreaPage>
</template>

<style scoped lang="scss">
.coloring-editor__title {
  margin: 0;
  font-size: var(--font-size-l);
}

.coloring-editor__note {
  margin: 0;
  color: var(--color-text-muted);
}
</style>
