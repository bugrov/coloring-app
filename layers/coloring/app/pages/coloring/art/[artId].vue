<script setup lang="ts">
import { ColoringRoutes } from '../../../../shared/routes'
import type { ColoringStageHandle } from '../../../composables/useColoringStage'

definePageMeta({ name: ColoringRoutes.EDITOR })

const route = useRoute()
const artId = computed(() => String(route.params.artId))

const editor = useEditorStore()
const stage = useTemplateRef<ColoringStageHandle>('stage')
const { art, title, tolerance, loadError, retry, historyError, retryHistory, notice, restarting, celebrating, congratulating, onStageReady, onOps, onProgress, undo, redo, restart, shareImage } = useColoringEditor(artId, stage)

useHead({ title: computed(() => title.value || 'Раскраска'), meta: [{ name: 'robots', content: 'noindex' }] })

/** The message of whatever stopped the editor from opening: the art, or its saved history. */
const failure = computed(() => loadError.value || historyError.value)

const confirmRestart = ref(false)

async function onRestartConfirmed() {
  confirmRestart.value = false
  await restart()
}
</script>

<template>
  <main class="editor">
    <EditorActions
      class="editor__actions"
      :can-restart="editor.canRestart && !restarting"
      @share="shareImage"
      @restart="confirmRestart = true"
    />

    <EditorFrame
      class="editor__frame"
      :percent="editor.progress.percent"
      :celebrating="celebrating"
      @celebrated="celebrating = false"
    >
      <ColoringStage
        v-if="art"
        ref="stage"
        :art="art"
        :tool="editor.tool"
        :color="editor.color"
        :opacity="editor.opacity"
        :thickness="editor.thickness"
        :locked="editor.locked"
        :tolerance="tolerance"
        @ready="onStageReady"
        @ops="onOps"
        @progress="onProgress"
      />
      <div
        v-if="!art || !editor.historyReady"
        class="editor__state"
        :class="{ 'editor__state--over': art }"
        :role="failure ? 'alert' : 'status'"
      >
        <template v-if="failure">
          <p>{{ failure }}</p>
          <button
            type="button"
            class="editor__retry"
            @click="loadError ? retry() : retryHistory()"
          >
            Повторить
          </button>
          <NuxtLink :to="{ name: ColoringRoutes.GALLERY }">
            К галерее
          </NuxtLink>
        </template>
        <p v-else>
          Загружаем рисунок…
        </p>
      </div>
      <template #status>
        <EditorSaveStatus
          v-if="editor.historyReady"
          :status="editor.saveStatus"
        />
      </template>
      <template #plate>
        <EditorHistoryBar
          :can-undo="editor.canUndo && !editor.locked"
          :can-redo="editor.canRedo && !editor.locked"
          @undo="undo"
          @redo="redo"
        />
      </template>
    </EditorFrame>

    <EditorToolbar class="editor__toolbar" />

    <EditorCongrats :open="congratulating" />

    <p
      v-if="notice"
      class="editor__notice"
      role="alert"
    >
      {{ notice }}
    </p>

    <LazyConfirmDialog
      v-if="confirmRestart"
      open
      title="Начать заново?"
      text="Рисунок очистится. Прежняя попытка сохранится в истории."
      confirm-label="Начать заново"
      danger
      @confirm="onRestartConfirmed"
      @cancel="confirmRestart = false"
    />
  </main>
</template>

<style scoped lang="scss">
// Figma "Coloring — Art": actions on the left, the framed art in the middle, crayons on the right edge.
// The crayons touch the screen edge, so only the safe-area inset separates them from it.
.editor {
  display: grid;
  grid-template-columns: var(--rail-width) minmax(0, 1fr) var(--rail-width);
  height: 100%;
  padding:
    calc(var(--safe-top) + var(--space-4))
    var(--safe-right)
    calc(var(--safe-bottom) + var(--space-4))
    var(--safe-left);
  background: var(--color-editor-bg);
}

.editor__state {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: var(--space-3);
  height: 100%;
  padding: var(--space-4);
  text-align: center;
}

.editor__state--over {
  position: absolute;
  inset: 0;
  background: var(--color-surface);
}

.editor__state p {
  margin: 0;
}

.editor__retry {
  padding: var(--space-2) var(--space-4);
  border: 0;
  border-radius: var(--radius-m);
  background: var(--color-progress);
  color: var(--color-on-overlay);
  font: inherit;
  cursor: pointer;
}

.editor__notice {
  position: fixed;
  bottom: calc(var(--safe-bottom) + var(--space-4));
  left: 50%;
  margin: 0;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-m);
  background: var(--color-overlay);
  color: var(--color-on-overlay);
  transform: translateX(-50%);
  z-index: var(--z-overlay);
}
</style>
