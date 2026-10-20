import { describe, expect, it } from 'vitest'
import { MAX_STROKE_POINTS } from '../../../../layers/coloring/shared'
import { StrokeRecorder } from '../../../../layers/coloring/app/engine'
import { PaintStroke, type StrokeStyle } from '../../../../layers/coloring/app/engine/painter'

const STYLE: StrokeStyle = { tool: 'brush', color: '#e53935', width: 40 }

/** A stroke whose drawing target only records calls; no canvas needed. */
function recordingStroke() {
  const calls: { from: [number, number] | null, points: number[] }[] = []
  let restored = 0
  const stroke = new PaintStroke(STYLE, {
    draw: (_style, from, points) => {
      calls.push({ from, points })
      return { x: 0, y: 0, width: 1, height: 1 }
    },
    rebase: () => {},
    restore: () => {
      restored++
    },
  })
  return { stroke, calls, restoredCount: () => restored }
}

const line = (pairs: number) => Array.from({ length: pairs * 2 }, (_, i) => (i % 2 === 0 ? i / 2 : 100))

describe('StrokeRecorder', () => {
  it('turns a short stroke into one op with all its points', () => {
    const { stroke } = recordingStroke()
    const recorder = new StrokeRecorder(7, stroke, () => {})
    recorder.add([10, 20])
    recorder.add([30, 40, 50, 60])

    expect(recorder.finish()).toEqual([
      { type: 'stroke', region: 7, tool: 'brush', color: '#e53935', width: 40, points: [10, 20, 30, 40, 50, 60] },
    ])
  })

  it('splits very long strokes while drawing, each op continuing from the previous one', () => {
    const { stroke, calls } = recordingStroke()
    const recorder = new StrokeRecorder(1, stroke, () => {})
    recorder.add(line(MAX_STROKE_POINTS * 2 + 10))
    const ops = recorder.finish()

    expect(ops).toHaveLength(3)
    expect(ops.every(op => op.points.length <= MAX_STROKE_POINTS * 2)).toBe(true)
    for (let i = 1; i < ops.length; i++) {
      const previous = ops[i - 1]!.points
      expect(ops[i]!.points.slice(0, 2)).toEqual(previous.slice(-2))
    }
    // Each continuation starts like a fresh op on replay: drawn from no previous point.
    expect(calls.filter(call => call.from === null)).toHaveLength(3)
  })

  it('reports the touched area once, when the stroke is finished', () => {
    const { stroke } = recordingStroke()
    const tracked: unknown[] = []
    const recorder = new StrokeRecorder(1, stroke, rect => tracked.push(rect))
    recorder.add([1, 1, 2, 2])

    expect(tracked).toHaveLength(0)
    recorder.finish()
    expect(tracked).toEqual([{ x: 0, y: 0, width: 1, height: 1 }])
  })

  it('takes the stroke back on cancel', () => {
    const { stroke, restoredCount } = recordingStroke()
    const recorder = new StrokeRecorder(1, stroke, () => {})
    recorder.add([1, 1])

    expect(recorder.cancel()).toEqual([])
    expect(restoredCount()).toBe(1)
  })

  it('keeps the parts of a split stroke when cancelled, so the canvas matches the ops', () => {
    const { stroke, restoredCount } = recordingStroke()
    const tracked: unknown[] = []
    const recorder = new StrokeRecorder(1, stroke, rect => tracked.push(rect))
    recorder.add(line(MAX_STROKE_POINTS + 10))

    const kept = recorder.cancel()

    expect(kept).toHaveLength(1)
    expect(kept[0]!.points).toHaveLength(MAX_STROKE_POINTS * 2)
    expect(restoredCount()).toBe(1)
    expect(tracked).toHaveLength(1)
  })
})
