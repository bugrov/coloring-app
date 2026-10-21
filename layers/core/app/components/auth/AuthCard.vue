<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <SafeAreaPage>
    <div class="auth-card">
      <section class="auth-card__panel">
        <h1 class="auth-card__title">
          {{ title }}
        </h1>
        <slot />
      </section>
    </div>
  </SafeAreaPage>
</template>

<style scoped lang="scss">
.auth-card {
  display: grid;
  place-items: center;
  height: 100%;
  overflow-y: auto;
}

// Compact by default: a phone held in landscape is only ~375px tall.
.auth-card__panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: min(100%, 420px);
  padding: var(--space-4) var(--space-6);
  border-radius: var(--radius-l);
  background: var(--color-surface);

  @media (min-height: 560px) {
    gap: var(--space-4);
    padding: var(--space-6);
  }
}

.auth-card__title {
  margin: 0;
  font-size: var(--font-size-l);
}
</style>
