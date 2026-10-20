<template>
  <main class="coloring-gallery">
    <h1 class="coloring-gallery__title">
      Раскраска
    </h1>
    <p class="coloring-gallery__note">
      Галерея появится на шаге 5.
    </p>
    <NuxtLink to="/">
      ← К играм
    </NuxtLink>
  </main>
</template>

<style scoped lang="scss">
.coloring-gallery {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  height: 100%;
  padding:
    calc(var(--safe-top) + var(--space-4))
    calc(var(--safe-right) + var(--space-4))
    calc(var(--safe-bottom) + var(--space-4))
    calc(var(--safe-left) + var(--space-4));
}

.coloring-gallery__title {
  margin: 0;
  font-size: var(--font-size-l);
}

.coloring-gallery__note {
  margin: 0;
  color: var(--color-text-muted);
}
</style>
