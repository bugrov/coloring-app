<script setup lang="ts">
const props = defineProps<{
  open: boolean
  title: string
  text: string
  confirmLabel: string
  /** The action cannot be undone: the confirm button is drawn as a warning. */
  danger?: boolean
}>()

const emit = defineEmits<{ confirm: [], cancel: [] }>()

const dialog = ref<HTMLDialogElement>()
/** What had the focus before the dialog opened; it gets it back when the dialog goes away. */
let opener: HTMLElement | null = null

// The native <dialog> gives a focus trap, Escape and a backdrop; Vue only mirrors `open` onto it.
watch(() => props.open, (open) => {
  if (!dialog.value) return
  if (open && !dialog.value.open) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.value.showModal()
  }

  if (!open && dialog.value.open) dialog.value.close()
}, { flush: 'post', immediate: true })

// A parent may remove the dialog instead of closing it: the native close (and its focus return) never happens then.
onBeforeUnmount(() => {
  dialog.value?.close()

  if (opener?.isConnected) opener.focus()
})
</script>

<template>
  <dialog
    ref="dialog"
    class="confirm"
    @cancel.prevent="emit('cancel')"
    @click.self="emit('cancel')"
  >
    <div class="confirm__body">
      <h2 class="confirm__title">
        {{ title }}
      </h2>
      <p class="confirm__text">
        {{ text }}
      </p>
      <div class="confirm__actions">
        <button
          class="button button--ghost"
          type="button"
          @click="emit('cancel')"
        >
          Отмена
        </button>
        <button
          class="button button--primary"
          :class="{ 'confirm__confirm--danger': danger }"
          type="button"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped lang="scss">
.confirm {
  width: min(92vw, 360px);
  padding: 0;
  border: 0;
  border-radius: var(--radius-l);
  background: var(--color-surface);
  color: var(--color-text);

  &::backdrop {
    background: var(--color-overlay);
  }
}

.confirm__body {
  padding: var(--space-6);
}

.confirm__title {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-l);
}

.confirm__text {
  margin: 0 0 var(--space-4);
  color: var(--color-text-muted);
}

.confirm__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.confirm__confirm--danger {
  background: var(--color-danger);
  color: var(--color-on-overlay);
}
</style>
