import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { DEFAULT_COLOR, DEFAULT_OPACITY, OPACITY_LEVELS } from '../../shared'
import type { Op, Tool } from '../../shared'
import { EMPTY_PROGRESS, type Progress } from '../engine'

/** How many colours the toolbar keeps within reach next to the full palette. */
export const RECENT_COLOR_COUNT = 3

/** Colours offered before the player has picked any; the last one is the selected colour. */
const INITIAL_RECENT = ['#1e88e5', '#fdd835', DEFAULT_COLOR]

/**
 * What the player has chosen in the editor (tool, colour, opacity, the open palette), the picture's
 * progress and an in-session undo history. The history is not saved anywhere yet; the sync step
 * replaces it with the stored one.
 */
export const useEditorStore = defineStore('coloring-editor', () => {
  const tool = ref<Tool>('brush')
  /** Most recently used colours; the last one is selected, so a pick moves a colour to the end. */
  const recentColors = ref<string[]>([...INITIAL_RECENT])
  const opacity = ref<number>(DEFAULT_OPACITY)
  const paletteOpen = ref(false)
  const progress = ref<Progress>({ ...EMPTY_PROGRESS })

  /** One entry per user action (a long stroke may be several ops, but one undo step). */
  const steps = shallowRef<Op[][]>([])
  /** Number of steps currently applied; the rest is the redo branch. */
  const cursor = ref(0)

  const color = computed(() => recentColors.value.at(-1)!)
  const canUndo = computed(() => cursor.value > 0)
  const canRedo = computed(() => cursor.value < steps.value.length)
  /** Starting over makes sense once something was drawn (or undone) in this picture. */
  const canRestart = computed(() => canUndo.value || canRedo.value || progress.value.percent > 0)
  /** Every op that makes up the picture now. */
  const activeOps = computed(() => steps.value.slice(0, cursor.value).flat())

  function selectColor(hex: string) {
    recentColors.value = [...recentColors.value.filter(entry => entry !== hex), hex].slice(-RECENT_COLOR_COUNT)
  }

  function togglePalette(open = !paletteOpen.value) {
    paletteOpen.value = open
  }

  /** Steps 100 → 75 → 50 → 25 → 100. */
  function cycleOpacity() {
    const index = (OPACITY_LEVELS as readonly number[]).indexOf(opacity.value)
    opacity.value = OPACITY_LEVELS[(index + 1) % OPACITY_LEVELS.length] ?? DEFAULT_OPACITY
  }

  /** Records a finished action; a new one cuts off the redo branch. */
  function record(ops: Op[]) {
    steps.value = [...steps.value.slice(0, cursor.value), ops]
    cursor.value = steps.value.length
  }

  function undo(): boolean {
    if (!canUndo.value) return false
    cursor.value -= 1
    return true
  }

  function redo(): boolean {
    if (!canRedo.value) return false
    cursor.value += 1
    return true
  }

  /** A fresh picture: no history, no progress. The tool, colour and opacity stay. */
  function resetPicture() {
    steps.value = []
    cursor.value = 0
    progress.value = { ...EMPTY_PROGRESS }
  }

  /** Called when an art is opened: nothing of the previous one carries over. */
  function open() {
    resetPicture()
    paletteOpen.value = false
  }

  return {
    tool,
    recentColors,
    color,
    opacity,
    paletteOpen,
    progress,
    canUndo,
    canRedo,
    canRestart,
    activeOps,
    selectColor,
    togglePalette,
    cycleOpacity,
    record,
    undo,
    redo,
    resetPicture,
    open,
  }
})
