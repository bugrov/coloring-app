<script setup lang="ts">
import { PALETTE_NAME_MAX_LENGTH } from '../../../../shared/admin'
import { ColoringRoutes } from '../../../../shared/routes'

definePageMeta({ name: ColoringRoutes.ADMIN_PALETTE, auth: 'admin' })
useHead({ title: 'Палитра: администратор', meta: [{ name: 'robots', content: 'noindex' }] })

const { colors, loadError, message, saving, dirty, save, resetToStandard } = useAdminPalette()
</script>

<template>
  <AdminPage title="Раскраска: палитра">
    <template #nav>
      <AdminNav />
    </template>

    <form
      class="palette"
      @submit.prevent="save"
    >
      <p class="palette__hint">
        32 цвета панели в редакторе, в том порядке, как их видит игрок. Название читают экранные дикторы, в панели подписей нет. Цвета в уже нарисованных рисунках не меняются.
      </p>

      <ul
        class="palette__strip"
        aria-label="Как выглядит палитра"
      >
        <li
          v-for="(color, index) in colors"
          :key="index"
          class="palette__chip"
          :style="{ background: color.hex }"
          :title="color.name"
        />
      </ul>

      <ol class="palette__list">
        <li
          v-for="(color, index) in colors"
          :key="index"
          class="palette__row"
        >
          <input
            v-model="color.hex"
            class="palette__color"
            type="color"
            :aria-label="`Цвет ${index + 1}`"
          >
          <input
            v-model="color.name"
            class="palette__name"
            type="text"
            :maxlength="PALETTE_NAME_MAX_LENGTH"
            :aria-label="`Название цвета ${index + 1}`"
            required
          >
        </li>
      </ol>

      <div class="palette__actions">
        <button
          class="button button--primary"
          type="submit"
          :disabled="saving || !dirty"
        >
          Сохранить
        </button>
        <button
          class="button button--ghost"
          type="button"
          @click="resetToStandard"
        >
          Вернуть стандартные
        </button>
      </div>
      <p
        v-if="message || loadError"
        class="palette__message"
        role="status"
      >
        {{ loadError || message }}
      </p>
    </form>
  </AdminPage>
</template>

<style scoped lang="scss">
.palette {
  display: grid;
  gap: var(--space-3);
}

.palette__hint,
.palette__message {
  margin: 0;
  color: var(--color-text-muted);
}

.palette__strip {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.palette__chip {
  width: 28px;
  height: 28px;
  border: 1px solid rgb(35 38 47 / 15%);
  border-radius: 6px;
}

.palette__list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.palette__row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.palette__color {
  flex: none;
  width: 56px;
  height: 44px;
  padding: 2px;
  border: 2px solid var(--color-bg);
  border-radius: var(--radius-m);
  background: var(--color-surface);
}

.palette__name {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  padding: 0 var(--space-3);
  border: 2px solid var(--color-bg);
  border-radius: var(--radius-m);
  background: var(--color-surface);
  font: inherit;
}

.palette__name:focus-visible,
.palette__color:focus-visible {
  border-color: var(--color-accent);
  outline: none;
}

.palette__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

@media (min-width: 900px) {
  .palette__list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2) var(--space-6);
  }
}
</style>
