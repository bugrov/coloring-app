<script setup lang="ts">
import { SVG_ERROR_MESSAGES, SVG_WARNING_MESSAGES } from '../../../shared'
import { ColoringRoutes } from '../../../shared/routes'

// Developer tool: shows how the SVG pipeline splits a drawing into regions.
// It becomes the admin "preview before publishing" in a later step.
// It needs no server data, so it stays open without signing in.
definePageMeta({ name: ColoringRoutes.LAB, auth: 'public' })
useHead({ title: 'SVG-лаборатория' })

const { samples, result, fileName, durationMs, stats, convert, convertFile } = useSvgLab()

function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]

  if (file) convertFile(file)
}
</script>

<template>
  <SafeAreaPage>
    <div class="lab">
      <header class="lab__toolbar">
        <h1 class="lab__title">
          SVG-лаборатория
        </h1>
        <button
          v-for="(source, name) in samples"
          :key="name"
          class="lab__button"
          type="button"
          @click="convert(source, name)"
        >
          {{ name }}
        </button>
        <label class="lab__button">
          Свой SVG…
          <input
            class="lab__file"
            type="file"
            accept=".svg,image/svg+xml"
            @change="onFileChange"
          >
        </label>
      </header>

      <p
        v-if="result && !result.ok"
        class="lab__error"
      >
        {{ fileName }}: {{ SVG_ERROR_MESSAGES[result.error] }}
      </p>

      <template v-if="result?.ok">
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
        <ArtPreview
          class="lab__preview"
          :art="result.art"
          highlight-regions
        />
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
