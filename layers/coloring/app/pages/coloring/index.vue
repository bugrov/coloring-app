<script setup lang="ts">
import { ColoringRoutes } from '../../../shared/routes'
import { useGalleryStore } from '../../stores/gallery'

definePageMeta({ name: ColoringRoutes.GALLERY })
useHead({ title: 'Раскраска' })

// The first page is fetched on the server (SSR) and handed to the client; a client-side visit fetches it again.
const gallery = useGalleryStore()

await useAsyncData('coloring-gallery', async () => {
  await gallery.loadFirst()

  return gallery.status
})
</script>

<template>
  <div class="gallery-page">
    <SafeAreaPage>
      <GalleryBoard />
    </SafeAreaPage>
  </div>
</template>

<style scoped lang="scss">
.gallery-page {
  --page-gutter: var(--space-gallery);

  position: fixed;
  inset: 0;
  background: var(--color-sky);
}
</style>
