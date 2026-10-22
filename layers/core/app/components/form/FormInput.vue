<script setup lang="ts">
// The attributes (id, name, type, aria-*, maxlength...) fall through to the <input>.
defineProps<{
  /** The field sits on a white card instead of the page colour. */
  onSurface?: boolean
}>()

const [model, modifiers] = defineModel<string | number | null>({
  set: value => (modifiers.number ? toNumber(value) : value),
})

/**
 * What `v-model.number` gives a native input, except that an empty field is `null`, not an empty string.
 * Meant for `type="number"`: in a text field a half-typed "5." would be rewritten to "5".
 */
function toNumber(value: string | number | null): number | null {
  if (value === null || value === '') return null
  const parsed = Number(value)

  return Number.isNaN(parsed) ? null : parsed
}
</script>

<template>
  <input
    v-model="model"
    class="form-input"
    :class="{ 'form-input--on-surface': onSurface }"
  >
</template>
