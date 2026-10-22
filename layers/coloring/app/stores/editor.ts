import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { DEFAULT_COLOR, DEFAULT_OPACITY, OPACITY_LEVELS, PALETTE } from '../../shared'
import type { PaletteColor, Tool } from '../../shared'
import { MAX_HISTORY_STEPS, type HistoryLog } from '../../shared/history'
import type { SyncStatus } from '../sync'
import { DEFAULT_THICKNESS, EMPTY_PROGRESS, THICKNESS_SCALES, type Progress } from '../engine'

/** How many colours the toolbar keeps within reach next to the full palette. */
export const RECENT_COLOR_COUNT = 3

/** Colours offered before the player has picked any; the last one is the selected colour. */
const INITIAL_RECENT = ['#1e88e5', '#fdd835', DEFAULT_COLOR]

/**
 * What the player has chosen in the editor (tool, colour, opacity, thickness, the open palette), the
 * picture's progress, and what the interface needs to know about the history and its saving. The
 * history itself lives in the engine's `Timeline`; this store only mirrors what the buttons show.
 */
export const useEditorStore = defineStore('coloring-editor', () => {
  const tool = ref<Tool>('brush')
  /** Most recently used colours; the last one is selected, so a pick moves a colour to the end. */
  const recentColors = ref<string[]>([...INITIAL_RECENT])
  const opacity = ref<number>(DEFAULT_OPACITY)
  /** Multiplier of the tool's line width, one of THICKNESS_SCALES. */
  const thickness = ref<number>(DEFAULT_THICKNESS)
  /** The colours of the panel; the standard set until the art that was opened brings the administrator's. */
  const palette = ref<readonly PaletteColor[]>(PALETTE)
  const paletteOpen = ref(false)
  const progress = ref<Progress>({ ...EMPTY_PROGRESS })

  const canUndo = ref(false)
  const canRedo = ref(false)
  /** Steps in the history, including the undone ones. */
  const historyLength = ref(0)
  /** False until the saved history has been loaded and drawn; the player cannot draw before. */
  const historyReady = ref(false)
  /** The picture is being rebuilt (a conflict was settled): drawing waits. */
  const rebuilding = ref(false)
  /** The attempt holds as many steps as it may; nothing more can be drawn until it is started over. */
  const historyFull = ref(false)
  const saveStatus = ref<SyncStatus>('saved')

  const color = computed(() => recentColors.value.at(-1)!)
  /** Drawing is possible only on a loaded picture that is not being rebuilt. */
  const locked = computed(() => !historyReady.value || rebuilding.value || historyFull.value)
  /** Starting over makes sense once something was drawn (or undone) in this picture. */
  const canRestart = computed(() => historyLength.value > 0 || progress.value.percent > 0)

  function selectColor(hex: string) {
    recentColors.value = [...recentColors.value.filter(entry => entry !== hex), hex].slice(-RECENT_COLOR_COUNT)
  }

  function setPalette(colors: readonly PaletteColor[]) {
    palette.value = colors
  }

  function togglePalette(open = !paletteOpen.value) {
    paletteOpen.value = open
  }

  /** Steps 100 → 75 → 50 → 25 → 100. */
  function cycleOpacity() {
    const index = (OPACITY_LEVELS as readonly number[]).indexOf(opacity.value)

    opacity.value = OPACITY_LEVELS[(index + 1) % OPACITY_LEVELS.length] ?? DEFAULT_OPACITY
  }

  /** Steps thin → normal → thick → thin. */
  function cycleThickness() {
    const index = (THICKNESS_SCALES as readonly number[]).indexOf(thickness.value)

    thickness.value = THICKNESS_SCALES[(index + 1) % THICKNESS_SCALES.length] ?? DEFAULT_THICKNESS
  }

  /** Takes over what the history allows right now. */
  function syncHistory(log: HistoryLog) {
    canUndo.value = log.canUndo
    canRedo.value = log.canRedo
    historyLength.value = log.length
    historyFull.value = log.cursor >= MAX_HISTORY_STEPS
  }

  /** A fresh picture: no history, no progress. The tool, colour, opacity and thickness stay. */
  function resetPicture() {
    canUndo.value = false
    canRedo.value = false
    historyLength.value = 0
    historyFull.value = false
    progress.value = { ...EMPTY_PROGRESS }
  }

  /** Called when an art is opened: nothing of the previous one carries over. */
  function open() {
    resetPicture()
    historyReady.value = false
    rebuilding.value = false
    saveStatus.value = 'saved'
    paletteOpen.value = false
  }

  return {
    tool,
    recentColors,
    color,
    opacity,
    thickness,
    palette,
    paletteOpen,
    progress,
    canUndo,
    canRedo,
    canRestart,
    historyLength,
    historyReady,
    historyFull,
    rebuilding,
    saveStatus,
    locked,
    selectColor,
    setPalette,
    togglePalette,
    cycleOpacity,
    cycleThickness,
    syncHistory,
    resetPicture,
    open,
  }
})
