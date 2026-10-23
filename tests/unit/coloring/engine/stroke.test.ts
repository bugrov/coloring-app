import { describe, expect, it } from 'vitest'
import { MAX_STROKE_POINTS } from '../../../../layers/coloring/shared'
import { StrokeRecorder } from '../../../../layers/coloring/app/engine'
import { PaintStroke, tracePolylineNear, type StrokeStyle } from '../../../../layers/coloring/app/engine/painter'

const STYLE: StrokeStyle = { tool: 'brush', color: '#e53935', width: 40 }

/** A stroke whose drawing target only records calls; no canvas needed. */
function recordingStroke() {
  const calls: { from: [number, number] | null, points: number[] }[] = []
  let restored = 0
  const stroke = new PaintStroke(STYLE, {
    toPaint: points => [...points],
    lengthToPaint: length => length,
    draw: (from, points) => {
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
    const recorder = new StrokeRecorder(7, stroke, () => {}, () => null, () => false)

    recorder.add([10, 20])
    recorder.add([30, 40, 50, 60])

    expect(recorder.finish().ops).toEqual([
      { type: 'stroke', region: 7, tool: 'brush', color: '#e53935', width: 40, points: [10, 20, 30, 40, 50, 60] },
    ])
  })

  it('splits very long strokes while drawing, each op continuing from the previous one', () => {
    const { stroke, calls } = recordingStroke()
    const recorder = new StrokeRecorder(1, stroke, () => {}, () => null, () => false)

    recorder.add(line(MAX_STROKE_POINTS * 2 + 10))
    const { ops } = recorder.finish()

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
    const recorder = new StrokeRecorder(1, stroke, rect => tracked.push(rect), () => null, () => false)

    recorder.add([1, 1, 2, 2])

    expect(tracked).toHaveLength(0)
    recorder.finish()
    expect(tracked).toEqual([{ x: 0, y: 0, width: 1, height: 1 }])
  })

  it('hands over what the stroke covered, unless it was split', () => {
    const covered = { id: 'before' }
    const short = recordingStroke()
    const recorder = new StrokeRecorder(1, short.stroke, () => {}, () => covered as never, () => false)

    recorder.add([1, 1, 2, 2])
    expect(recorder.finish().delta).toBe(covered)

    const long = recordingStroke()
    const split = new StrokeRecorder(1, long.stroke, () => {}, () => covered as never, () => false)

    split.add(line(MAX_STROKE_POINTS + 10))
    expect(split.finish().delta).toBeNull()
  })

  it('takes back a stroke that changed nothing and records no op', () => {
    const { stroke, restoredCount } = recordingStroke()
    const tracked: unknown[] = []
    const before = { canvas: { width: 1, height: 1 }, rect: { x: 0, y: 0, width: 1, height: 1 } }
    const recorder = new StrokeRecorder(1, stroke, rect => tracked.push(rect), () => before as never, () => true)

    recorder.add([1, 1, 2, 2])

    expect(recorder.finish()).toEqual({ ops: [], delta: null })
    expect(restoredCount()).toBe(1)
    expect(tracked).toHaveLength(0)
  })

  it('takes the stroke back on cancel', () => {
    const { stroke, restoredCount } = recordingStroke()
    const recorder = new StrokeRecorder(1, stroke, () => {}, () => null, () => false)

    recorder.add([1, 1])
    recorder.cancel()

    expect(recorder.isSplit).toBe(false)
    expect(restoredCount()).toBe(1)
  })

  it('reports when a stroke was split and can no longer be taken back', () => {
    const { stroke } = recordingStroke()
    const recorder = new StrokeRecorder(1, stroke, () => {}, () => null, () => false)

    recorder.add(line(MAX_STROKE_POINTS + 10))

    expect(recorder.isSplit).toBe(true)
  })
})

describe('tracePolylineNear', () => {
  function trace(line: number[], rect = { x: 100, y: 0, width: 10, height: 10 }, reach = 5) {
    const calls: string[] = []
    const ctx = {
      moveTo: (x: number, y: number) => calls.push(`M${x},${y}`),
      lineTo: (x: number, y: number) => calls.push(`L${x},${y}`),
    }

    tracePolylineNear(ctx as unknown as CanvasRenderingContext2D, line, rect, reach)

    return calls.join(' ')
  }

  it('draws a dot for a single point', () => {
    expect(trace([3, 4])).toBe('M3,4 L3,4')
  })

  it('skips segments far from the rectangle and keeps the ones that can touch it', () => {
    // 0→50 is far from x 95..115; 50→100 and 100→150 reach into it; 150→200 is far again.
    expect(trace([0, 5, 50, 5, 100, 5, 150, 5, 200, 5])).toBe('M50,5 L50,5 L100,5 L150,5')
  })

  it('keeps every segment when the rectangle covers the whole line, as on replay', () => {
    expect(trace([0, 0, 10, 0, 20, 0], { x: 0, y: 0, width: 30, height: 10 })).toBe('M0,0 L0,0 L10,0 L20,0')
  })
})
