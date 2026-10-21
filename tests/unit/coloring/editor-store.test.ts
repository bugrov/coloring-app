import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Op } from '../../../layers/coloring/shared'
import { useEditorStore } from '../../../layers/coloring/app/stores/editor'

const fill = (region: number): Op => ({ type: 'fill', region, color: '#e53935' })

describe('editor store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('keeps the three most recent colours, the last one selected', () => {
    const editor = useEditorStore()
    expect(editor.recentColors).toHaveLength(3)

    editor.selectColor('#43a047')
    expect(editor.color).toBe('#43a047')
    expect(editor.recentColors).toHaveLength(3)
    expect(editor.recentColors).not.toContain('#1e88e5')
  })

  it('steps the line thickness through thin, normal and thick and back', () => {
    const editor = useEditorStore()
    const seen = [editor.thickness]

    for (let i = 0; i < 3; i++) {
      editor.cycleThickness()
      seen.push(editor.thickness)
    }

    expect(seen).toEqual([1, 1.8, 0.5, 1])
  })

  it('moves an already recent colour to the end instead of duplicating it', () => {
    const editor = useEditorStore()
    const [first] = editor.recentColors

    editor.selectColor(first!)

    expect(editor.color).toBe(first)
    expect(editor.recentColors).toHaveLength(3)
    expect(new Set(editor.recentColors).size).toBe(3)
  })

  it('steps the opacity 100, 75, 50, 25 and back to 100', () => {
    const editor = useEditorStore()
    const seen = [editor.opacity]
    for (let i = 0; i < 4; i++) {
      editor.cycleOpacity()
      seen.push(editor.opacity)
    }
    expect(seen).toEqual([100, 75, 50, 25, 100])
  })

  it('undoes and redoes whole actions, and a new action cuts off the redo branch', () => {
    const editor = useEditorStore()
    editor.record([fill(1), fill(1)])
    editor.record([fill(2)])
    expect(editor.activeOps).toHaveLength(3)

    expect(editor.undo()).toBe(true)
    expect(editor.activeOps).toHaveLength(2)
    expect(editor.canRedo).toBe(true)

    editor.record([fill(3)])
    expect(editor.canRedo).toBe(false)
    expect(editor.activeOps.map(op => op.region)).toEqual([1, 1, 3])
  })

  it('refuses to undo or redo past the ends', () => {
    const editor = useEditorStore()
    expect(editor.undo()).toBe(false)
    expect(editor.redo()).toBe(false)
  })

  it('opening an art drops the history and closes the palette but keeps the choices', () => {
    const editor = useEditorStore()
    editor.selectColor('#43a047')
    editor.record([fill(1)])
    editor.togglePalette(true)

    editor.open()

    expect(editor.canUndo).toBe(false)
    expect(editor.paletteOpen).toBe(false)
    expect(editor.color).toBe('#43a047')
  })
})
