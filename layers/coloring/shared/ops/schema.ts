import { z } from 'zod'
import { MAX_STROKE_POINTS, OP_GRID, OP_GRID_REACH, OPACITY_LEVELS, TOOLS } from './constants'

const regionId = z.number().int().positive()
const color = z.string().regex(/^#[0-9a-f]{6}$/)
/** Percent; absent means fully opaque, so ops saved before opacity existed stay valid. */
const opacity = z.number().int().min(Math.min(...OPACITY_LEVELS)).max(100)
const coordinate = z.number().int().min(-OP_GRID_REACH).max(OP_GRID + OP_GRID_REACH)

export const strokeOpSchema = z.object({
  type: z.literal('stroke'),
  /** Region the stroke started in; drawing never leaves it. */
  region: regionId,
  tool: z.enum(TOOLS),
  /** Null for the eraser. */
  color: color.nullable(),
  /** Paint opacity in percent; never set for the eraser, which removes paint completely. */
  opacity: opacity.optional(),
  /** Line width in grid units. */
  width: z.number().int().positive().max(OP_GRID),
  /** Flat list of x, y pairs in grid units. */
  points: z.array(coordinate).min(2).max(MAX_STROKE_POINTS * 2)
    .refine(points => points.length % 2 === 0, 'Points must be x, y pairs'),
}).refine(op => (op.tool === 'eraser') === (op.color === null), 'Pencil and brush need a colour; the eraser has none')
  .refine(op => op.tool !== 'eraser' || op.opacity === undefined, 'The eraser has no opacity')

/** Long press with the pencil or the brush: the whole region takes the colour. */
export const fillOpSchema = z.object({
  type: z.literal('fill'),
  region: regionId,
  color,
  opacity: opacity.optional(),
})

/** Long press with the eraser: the whole region is cleared. */
export const clearOpSchema = z.object({
  type: z.literal('clear'),
  region: regionId,
})

/**
 * A user action on an art. Ops are the unit of history (undo/redo), of
 * persistence and of replay: applying the same ops to a blank canvas
 * reproduces the drawing.
 */
export const opSchema = z.discriminatedUnion('type', [strokeOpSchema, fillOpSchema, clearOpSchema])
