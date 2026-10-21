<script setup lang="ts">
import { PALETTE, TOOLS } from '../../../shared'
import type { ColoringStageHandle } from '../../composables/useColoringStage'

// Developer tool for the drawing engine; the real editor UI comes in a later step.
useHead({ title: 'Песочница движка', meta: [{ name: 'robots', content: 'noindex' }] })

const TOOL_LABELS = { pencil: 'Карандаш', brush: 'Кисть', eraser: 'Резинка' } as const

const stage = useTemplateRef<ColoringStageHandle>('stage')
const { arts, artName, art, tool, color, ops, progress, frameStats, addOps, onProgress, replay, clear, share } = useColoringSandbox(stage)
</script>

<template>
  <SafeAreaPage>
    <div class="sandbox">
      <ColoringStage
        ref="stage"
        class="sandbox__stage"
        :art="art"
        :tool="tool"
        :color="color"
        @ops="addOps"
        @progress="onProgress"
      />

      <aside class="sandbox__panel">
        <select
          v-model="artName"
          class="sandbox__select"
          aria-label="Рисунок"
        >
          <option
            v-for="entry in arts"
            :key="entry.name"
          >
            {{ entry.name }}
          </option>
        </select>

        <div class="sandbox__tools">
          <button
            v-for="name in TOOLS"
            :key="name"
            type="button"
            class="sandbox__button"
            :class="{ 'sandbox__button--active': tool === name }"
            @click="tool = name"
          >
            {{ TOOL_LABELS[name] }}
          </button>
        </div>

        <div class="sandbox__palette">
          <button
            v-for="swatch in PALETTE"
            :key="swatch.hex"
            type="button"
            class="sandbox__swatch"
            :class="{ 'sandbox__swatch--active': color === swatch.hex }"
            :style="{ background: swatch.hex }"
            :aria-label="swatch.name"
            @click="color = swatch.hex"
          />
        </div>

        <p class="sandbox__info">
          {{ progress.percent }}%{{ progress.complete ? ' — готово!' : '' }}<br>
          операций: {{ ops.length }}<br>
          кадр: в среднем {{ frameStats.average.toFixed(1) }} мс, макс. {{ frameStats.max.toFixed(1) }}
        </p>

        <div class="sandbox__tools">
          <button
            type="button"
            class="sandbox__button"
            @click="replay"
          >
            Перерисовать из операций
          </button>
          <button
            type="button"
            class="sandbox__button"
            @click="stage?.resetView()"
          >
            Сбросить зум
          </button>
          <button
            type="button"
            class="sandbox__button"
            @click="clear"
          >
            Очистить
          </button>
          <button
            type="button"
            class="sandbox__button"
            @click="share"
          >
            Сохранить / поделиться
          </button>
        </div>
      </aside>
    </div>
  </SafeAreaPage>
</template>

<style scoped lang="scss">
.sandbox {
  display: flex;
  gap: var(--space-3);
  height: 100%;
  min-height: 0;
}

.sandbox__stage {
  flex: 1;
  min-width: 0;
  border-radius: var(--radius-m);
  background: var(--color-surface);
}

.sandbox__panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 168px;
  overflow-y: auto;
}

.sandbox__tools {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.sandbox__select,
.sandbox__button {
  padding: var(--space-2);
  border: 0;
  border-radius: var(--radius-m);
  background: var(--color-surface);
  font-size: var(--font-size-s);
}

.sandbox__button--active {
  background: var(--color-accent);
}

.sandbox__palette {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-1);
}

.sandbox__swatch {
  aspect-ratio: 1;
  min-height: 32px;
  border: 2px solid transparent;
  border-radius: 50%;
}

.sandbox__swatch--active {
  border-color: var(--color-text);
  transform: scale(1.1);
}

.sandbox__info {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-s);
}
</style>
