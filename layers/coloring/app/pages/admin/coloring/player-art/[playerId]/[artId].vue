<script setup lang="ts">
import { ColoringRoutes } from '../../../../../../shared/routes'
import type { ColoringStageHandle } from '../../../../../composables/useColoringStage'

definePageMeta({ name: ColoringRoutes.ADMIN_PLAYER_ART, auth: 'admin' })
useHead({ title: 'Рисунок игрока: администратор' })

const route = useRoute()
const playerId = computed(() => String(route.params.playerId))
const artId = computed(() => String(route.params.artId))
const attempt = computed(() => {
  const value = Number(route.query.attempt)

  return Number.isInteger(value) && value > 0 ? value : undefined
})

const stage = useTemplateRef<ColoringStageHandle>('stage')
const { state, loadError, step, total, rebuilding, onStageReady } = usePlayerArtView(playerId, artId, attempt, stage)
</script>

<template>
  <AdminPage :title="state ? `${state.title}, попытка ${state.history.attempt}` : 'Рисунок игрока'">
    <template #nav>
      <AdminNav />
    </template>

    <p
      v-if="loadError"
      class="view__error"
      role="alert"
    >
      {{ loadError }}
    </p>

    <div
      v-else-if="state"
      class="view"
    >
      <div class="view__stage">
        <ColoringStage
          ref="stage"
          :art="state.art"
          tool="brush"
          color="#000000"
          locked
          @ready="onStageReady"
        />
      </div>
      <div class="view__controls">
        <label
          class="view__label"
          for="view-step"
        >
          Шаг {{ step }} из {{ total }}
        </label>
        <input
          id="view-step"
          v-model.number="step"
          class="view__slider"
          type="range"
          min="0"
          :max="total"
          step="1"
        >
        <p class="view__hint">
          {{ rebuilding ? 'Собираем картинку…' : 'Картинка собирается проигрыванием шагов, ничего не меняется.' }}
        </p>
      </div>
    </div>
  </AdminPage>
</template>

<style scoped lang="scss">
.view {
  display: grid;
  gap: var(--space-4);
}

.view__stage {
  position: relative;
  height: 60dvh;
  overflow: hidden;
  border-radius: var(--radius-m);
  background: var(--color-surface);
}

.view__controls {
  display: grid;
  gap: var(--space-2);
}

.view__label {
  font-weight: 600;
}

.view__slider {
  width: 100%;
  min-height: 44px;
}

.view__hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-s);
}

.view__error {
  margin: 0;
  color: var(--color-danger);
}
</style>
