import type { z } from 'zod'
import type { TOOLS } from '../ops/constants'
import type { clearOpSchema, fillOpSchema, opSchema, strokeOpSchema } from '../ops/schema'

export type Tool = typeof TOOLS[number]
export type StrokeOp = z.infer<typeof strokeOpSchema>
export type FillOp = z.infer<typeof fillOpSchema>
export type ClearOp = z.infer<typeof clearOpSchema>
export type Op = z.infer<typeof opSchema>
