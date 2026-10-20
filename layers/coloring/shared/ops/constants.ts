/**
 * Operation coordinates are integers on a grid that spans the art's long side
 * with this many units, independent of the art's viewBox and of the canvas
 * resolution used to render it.
 */
export const OP_GRID = 4096

export const TOOLS = ['pencil', 'brush', 'eraser'] as const

/** Upper bound for a single stroke; longer gestures are split into several strokes. */
export const MAX_STROKE_POINTS = 2000
