import { z } from 'zod'

/**
 * Normalized, render-ready artwork produced by the SVG pipeline. The original
 * SVG markup is never stored or rendered; only this structure is.
 *
 * `items` keep the source document order (z-order). Rendering draws them all
 * once (regions white, ink in its colour) and multiplies that over the paint
 * layer, so ink stays on top of paint while honouring the original stacking.
 */
/** 2: regions carry their bounds. */
export const ART_FORMAT_VERSION = 2

/** Only path commands, numbers and separators: no room for markup or URLs. */
const PATH_DATA = /^[MmZzLlHhVvCcSsQqTtAa0-9eE.,\s+-]+$/

const pathData = z.string().min(1).regex(PATH_DATA, 'Invalid path data')
const fillRule = z.enum(['nonzero', 'evenodd'])
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/)

/** A colourable area. `background` is the canvas outside the drawing. */
export const regionSchema = z.object({
  type: z.literal('region'),
  id: z.number().int().positive(),
  kind: z.enum(['area', 'background']),
  d: pathData,
  fillRule,
  /**
   * [minX, minY, maxX, maxY] in art units, an upper bound of the shape.
   * Computed once on import so the client never has to parse path data again.
   */
  bounds: z.tuple([z.number(), z.number(), z.number(), z.number()])
    .refine(([minX, minY, maxX, maxY]) => minX <= maxX && minY <= maxY, 'Bounds must be ordered'),
})

/** Non-colourable line art: outlines and dark fills. */
export const inkSchema = z.object({
  type: z.literal('ink'),
  d: pathData,
  fillRule,
  fill: hexColor.nullable(),
  stroke: hexColor.nullable(),
  strokeWidth: z.number().nonnegative(),
  lineCap: z.enum(['butt', 'round', 'square']),
  lineJoin: z.enum(['miter', 'round', 'bevel']),
  miterLimit: z.number().positive(),
})

export const artSchema = z.object({
  version: z.literal(ART_FORMAT_VERSION),
  viewBox: z.tuple([z.number(), z.number(), z.number().positive(), z.number().positive()]),
  items: z.array(z.discriminatedUnion('type', [regionSchema, inkSchema])).min(1),
})

export function isValidPathData(d: string): boolean {
  return PATH_DATA.test(d)
}
