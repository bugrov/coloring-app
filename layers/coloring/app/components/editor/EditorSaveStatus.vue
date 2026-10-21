<script setup lang="ts">
import type { SyncStatus } from '../../sync'

defineProps<{ status: SyncStatus }>()

const TEXTS: Record<SyncStatus, string> = {
  saved: 'Сохранено',
  saving: 'Сохраняем…',
  offline: 'Нет связи, сохраним позже',
  failed: 'Не удалось сохранить',
}
</script>

<template>
  <p
    class="save-status"
    :class="`save-status--${status}`"
    role="status"
  >
    <span
      class="save-status__dot"
      aria-hidden="true"
    />
    {{ TEXTS[status] }}
  </p>
</template>

<style scoped lang="scss">
// A quiet line over the corner of the picture; it must never get in the way of drawing.
.save-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  color: var(--color-text);
  font-size: 0.75rem;
  opacity: 0.6;
  pointer-events: none;
  transition: opacity var(--duration-base);
}

.save-status__dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-progress);
}

.save-status--saving .save-status__dot {
  opacity: 0.5;
}

.save-status--offline,
.save-status--failed {
  opacity: 1;
}

.save-status--offline .save-status__dot {
  background: #f9a825;
}

.save-status--failed .save-status__dot {
  background: #e53935;
}

@media (prefers-reduced-motion: reduce) {
  .save-status {
    transition: none;
  }
}
</style>
