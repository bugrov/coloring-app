<script setup lang="ts">
defineProps<{
  submitLabel: string
  pending: boolean
  /** A message for the form as a whole (field messages are shown by the fields). */
  error: string
}>()

const emit = defineEmits<{ submit: [] }>()
</script>

<template>
  <form
    class="auth-form"
    novalidate
    @submit.prevent="emit('submit')"
  >
    <slot />
    <p
      class="auth-form__error"
      role="alert"
    >
      {{ error }}
    </p>
    <button
      class="button button--primary"
      type="submit"
      :disabled="pending"
    >
      {{ submitLabel }}
    </button>
  </form>
</template>

<style scoped lang="scss">
.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.auth-form__error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--font-size-s);

  @media (min-height: 560px) {
    min-height: 1.25em;
  }
}
</style>
