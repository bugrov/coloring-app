<script setup lang="ts">
defineProps<{
  label: string
  /** The message of the field, shown under it. */
  error?: string
}>()
</script>

<template>
  <label class="form-field">
    <span class="form-field__label">{{ label }}</span>
    <slot />
    <span
      class="form-field__error"
      role="alert"
    >{{ error }}</span>
  </label>
</template>

<style scoped lang="scss">
.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-field__label {
  font-size: var(--font-size-s);
  color: var(--color-text-muted);
}

.form-field__error {
  min-height: 1.25em;
  font-size: var(--font-size-s);
  color: var(--color-danger);
}
</style>
