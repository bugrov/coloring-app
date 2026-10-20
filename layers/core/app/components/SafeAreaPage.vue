<template>
  <main class="safe-area-page">
    <slot />
  </main>
</template>

<style scoped lang="scss">
// Full-screen page whose content stays clear of notches, the side Dynamic
// Island in landscape and the home indicator.
.safe-area-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  height: 100%;
  padding:
    calc(var(--safe-top) + var(--space-4))
    calc(var(--safe-right) + var(--space-4))
    calc(var(--safe-bottom) + var(--space-4))
    calc(var(--safe-left) + var(--space-4));
}
</style>
