import { z } from 'zod'
import { MAX_STROKE_POINTS, OP_GRID, TOOLS } from './constants'

/**
 * A user action on an art. Ops are the unit of history (undo/redo), of
 * persistence and of replay: applying the same ops to a blank canvas
 * reproduces the drawing.
 */
const regionId = z.number().int().positive()
const color = z.string().regex(/^#[0-9a-f]{6}$/)
const coordinate = z.number().int().min(0).max(OP_GRID)

export const strokeOpSchema = z.object({
  type: z.literal('stroke'),
  /** Region the stroke started in; drawing never leaves it. */
  region: regionId,
  tool: z.enum(TOOLS),
  /** Null for the eraser. */
  color: color.nullable(),
  /** Line width in grid units. */
  width: z.number().int().positive().max(OP_GRID),
  /** Flat list of x, y pairs in grid units. */
  points: z.array(coordinate).min(2).max(MAX_STROKE_POINTS * 2)
    .refine(points => points.length % 2 === 0, 'Points must be x, y pairs'),
})

/** Long press with the pencil or the brush: the whole region takes the colour. */
export const fillOpSchema = z.object({
  type: z.literal('fill'),
  region: regionId,
  color,
})

/** Long press with the eraser: the whole region is cleared. */
export const clearOpSchema = z.object({
  type: z.literal('clear'),
  region: regionId,
})

export const opSchema = z.discriminatedUnion('type', [strokeOpSchema, fillOpSchema, clearOpSchema])
