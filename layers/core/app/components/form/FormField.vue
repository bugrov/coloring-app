<script setup lang="ts">
defineProps<{
  label: string
  /** The validation message of the field, shown under it. */
  error?: string
}>()

const id = useId()
</script>

<template>
  <div class="form-field">
    <label
      class="form-field__label"
      :for="id"
    >{{ label }}</label>
    <!-- The control takes these: its label, and the message that describes its state. -->
    <slot
      :id="id"
      :described-by="`${id}-error`"
      :invalid="Boolean(error)"
    />
    <span
      :id="`${id}-error`"
      class="form-field__error"
      role="alert"
    >{{ error }}</span>
  </div>
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
  font-size: var(--font-size-s);
  color: var(--color-danger);

  // Room for the message is reserved only where height is plentiful, so it does not shift the form.
  @media (min-height: 560px) {
    min-height: 1.25em;
  }
}
</style>
