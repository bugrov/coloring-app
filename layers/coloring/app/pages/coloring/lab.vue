<script setup lang="ts">
import octopusSvg from '../../../server/assets/arts/octopus.svg?raw'
import catSvg from '../../../server/assets/arts/cat.svg?raw'
import houseSvg from '../../../server/assets/arts/house.svg?raw'
import type { ArtItem } from '../../../shared/art'
import { SVG_ERROR_MESSAGES, SVG_WARNING_MESSAGES } from '../../../shared/svg/messages'
import { convertSvg, type SvgConversion } from '../../../shared/svg/pipeline'

// Developer tool: shows how the SVG pipeline splits a drawing into regions.
// It becomes the admin "preview before publishing" in a later step.
useHead({ title: 'SVG-лаборатория', meta: [{ name: 'robots', content: 'noindex' }] })

const SAMPLES = { Осьминог: octopusSvg, Кошка: catSvg, Дом: houseSvg }

/** Golden-angle hues keep neighbouring region ids visually distinct. */
const GOLDEN_ANGLE = 137.508

const result = shallowRef<SvgConversion | null>(null)
const durationMs = ref(0)
const fileName = ref('')

function run(source: string, name: string) {
  const started = performance.now()
  result.value = convertSvg(source)
  durationMs.value = Math.round(performance.now() - started)
  fileName.value = name
}

async function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) run(await file.text(), file.name)
}

const art = computed(() => (result.value?.ok ? result.value.art : null))
const stats = computed(() => {
  const items = art.value?.items ?? []
  return {
    areas: items.filter(item => item.type === 'region' && item.kind === 'area').length,
    ink: items.filter(item => item.type === 'ink').length,
  }
})

const regionFill = (item: ArtItem) =>
  item.type === 'region' && item.kind === 'area' ? `hsl(${(item.id * GOLDEN_ANGLE) % 360} 70% 75%)` : '#fff'
</script>

<template>
  <SafeAreaPage>
    <div class="lab">
      <header class="lab__toolbar">
        <h1 class="lab__title">
          SVG-лаборатория
        </h1>
        <button
          v-for="(source, name) in SAMPLES"
          :key="name"
          class="lab__button"
          type="button"
          @click="run(source, name)"
        >
          {{ name }}
        </button>
        <label class="lab__button">
          Свой SVG…
          <input
            class="lab__file"
            type="file"
            accept=".svg,image/svg+xml"
            @change="onFile"
          >
        </label>
      </header>

      <p
        v-if="result && !result.ok"
        class="lab__error"
      >
        {{ fileName }}: {{ SVG_ERROR_MESSAGES[result.error] }}
      </p>

      <template v-if="art && result?.ok">
        <p class="lab__stats">
          {{ fileName }}: областей {{ stats.areas }}, линий {{ stats.ink }}, {{ durationMs }} мс
        </p>
        <ul
          v-if="result.warnings.length"
          class="lab__warnings"
        >
          <li
            v-for="warning in result.warnings"
            :key="warning.code + warning.detail"
          >
            {{ SVG_WARNING_MESSAGES[warning.code] }} <code v-if="warning.detail">{{ warning.detail }}</code>
          </li>
        </ul>
        <svg
          class="lab__preview"
          :viewBox="art.viewBox.join(' ')"
        >
          <template
            v-for="(item, index) in art.items"
            :key="index"
          >
            <path
              v-if="item.type === 'region'"
              :d="item.d"
              :fill="regionFill(item)"
              :fill-rule="item.fillRule"
            />
            <path
              v-else
              :d="item.d"
              :fill="item.fill ?? 'none'"
              :fill-rule="item.fillRule"
              :stroke="item.stroke ?? 'none'"
              :stroke-width="item.strokeWidth"
              :stroke-linecap="item.lineCap"
              :stroke-linejoin="item.lineJoin"
              :stroke-miterlimit="item.miterLimit"
            />
          </template>
        </svg>
      </template>
    </div>
  </SafeAreaPage>
</template>

<style scoped lang="scss">
.lab {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-height: 0;
  height: 100%;
  overflow: auto;
}

.lab__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.lab__title {
  margin: 0 var(--space-2) 0 0;
  font-size: var(--font-size-l);
}

.lab__button {
  position: relative;
  padding: var(--space-2) var(--space-4);
  border: 0;
  border-radius: var(--radius-m);
  background: var(--color-surface);
  cursor: pointer;
}

.lab__file {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.lab__error {
  margin: 0;
  color: var(--color-danger);
}

.lab__stats,
.lab__warnings {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-s);
}

.lab__preview {
  flex: 1 0 240px;
  width: 100%;
  min-height: 240px;
  border-radius: var(--radius-m);
  background: var(--color-surface);
}
</style>
