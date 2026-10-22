import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { HistoryLog } from '../../../layers/coloring/shared/history'
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

  it('shows the standard palette until an art brings the one of the administrator, and the toolbar reads it from the store', () => {
    const editor = useEditorStore()

    expect(editor.palette).toHaveLength(32)

    editor.setPalette([{ hex: '#123456', name: 'Мой цвет' }])

    expect(editor.palette).toEqual([{ hex: '#123456', name: 'Мой цвет' }])
  })

  it('replaces recent colours that the palette of the administrator does not have, and keeps those it has', () => {
    const editor = useEditorStore()
    const palette = [{ hex: '#111111', name: 'A' }, { hex: '#222222', name: 'B' }, { hex: '#333333', name: 'C' }, { hex: '#444444', name: 'D' }]

    editor.selectColor('#222222')
    editor.setPalette(palette)

    expect(editor.recentColors).toHaveLength(3)
    expect(editor.recentColors.every(hex => palette.some(color => color.hex === hex))).toBe(true)
    expect(editor.color).toBe('#222222')
  })

  it('mirrors what the history allows, and starting over needs something to start over from', () => {
    const editor = useEditorStore()

    expect(editor.canRestart).toBe(false)

    const log = new HistoryLog()

    log.push([fill(1)])
    log.push([fill(2)])
    log.undo()
    editor.syncHistory(log)

    expect(editor.canUndo).toBe(true)
    expect(editor.canRedo).toBe(true)
    expect(editor.canRestart).toBe(true)
  })

  it('locks drawing until the saved history is on the canvas, and while the canvas is rebuilt', () => {
    const editor = useEditorStore()

    expect(editor.locked).toBe(true)

    editor.historyReady = true
    expect(editor.locked).toBe(false)

    editor.rebuilding = true
    expect(editor.locked).toBe(true)
  })

  it('stays locked while the attempt is started over, whatever a settled conflict does to the rebuilding flag', () => {
    const editor = useEditorStore()

    editor.historyReady = true
    editor.restarting = true
    editor.rebuilding = true
    editor.rebuilding = false

    expect(editor.locked).toBe(true)

    editor.restarting = false

    expect(editor.locked).toBe(false)
  })

  it('opening an art drops the history and closes the palette but keeps the choices', () => {
    const editor = useEditorStore()
    const log = new HistoryLog()

    log.push([fill(1)])
    editor.selectColor('#43a047')
    editor.syncHistory(log)
    editor.historyReady = true
    editor.togglePalette(true)

    editor.open()

    expect(editor.canUndo).toBe(false)
    expect(editor.historyReady).toBe(false)
    expect(editor.paletteOpen).toBe(false)
    expect(editor.color).toBe('#43a047')
  })
})
