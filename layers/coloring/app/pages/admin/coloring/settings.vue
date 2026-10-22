<script setup lang="ts">
import { ColoringRoutes } from '../../../../shared/routes'
import { MAX_PAINTED_TOLERANCE, MIN_PAINTED_TOLERANCE } from '../../../../shared/admin'

definePageMeta({ name: ColoringRoutes.ADMIN_SETTINGS, auth: 'admin' })
useHead({ title: 'Настройки: администратор' })

const { tolerance, loadError, message, saving, saveTolerance } = useAdminSettings()

/** The field shows whole percent; the setting is a share. */
const percent = ref<number | null>(null)

watch(tolerance, (value) => {
  if (value !== undefined) percent.value = Math.round(value * 100)
}, { immediate: true })

const MIN_PERCENT = MIN_PAINTED_TOLERANCE * 100
const MAX_PERCENT = MAX_PAINTED_TOLERANCE * 100

async function save() {
  if (percent.value === null) return
  await saveTolerance(percent.value / 100)
}
</script>

<template>
  <AdminPage title="Раскраска: настройки">
    <template #nav>
      <AdminNav />
    </template>

    <form
      class="settings"
      @submit.prevent="save"
    >
      <label
        class="settings__label"
        for="tolerance"
      >
        Сколько процентов области должно быть закрашено, чтобы она считалась готовой
      </label>
      <p class="settings__hint">
        Мелкие щели вдоль контура не мешают дойти до 100 %. По умолчанию 95. Новое значение получат игроки при следующем открытии рисунка.
      </p>
      <div class="settings__row">
        <FormInput
          id="tolerance"
          v-model.number="percent"
          on-surface
          class="settings__input"
          type="number"
          inputmode="numeric"
          :min="MIN_PERCENT"
          :max="MAX_PERCENT"
          step="1"
        />
        <span aria-hidden="true">%</span>
        <button
          class="button button--primary"
          type="submit"
          :disabled="saving || percent === null"
        >
          Сохранить
        </button>
      </div>
      <p
        v-if="message || loadError"
        class="settings__message"
        role="status"
      >
        {{ loadError || message }}
      </p>
    </form>
  </AdminPage>
</template>

<style scoped lang="scss">
.settings {
  display: grid;
  max-width: 560px;
  gap: var(--space-3);
}

.settings__label {
  font-weight: 600;
}

.settings__hint,
.settings__message {
  margin: 0;
  color: var(--color-text-muted);
}

.settings__input {
  width: 96px;
}

.settings__row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
</style>
