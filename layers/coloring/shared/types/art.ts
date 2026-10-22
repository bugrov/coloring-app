import type { z } from 'zod'
import type { artSchema, inkSchema, regionSchema } from '../art/schema'

export type ArtRegion = z.infer<typeof regionSchema>
export type ArtInk = z.infer<typeof inkSchema>
export type ArtItem = ArtRegion | ArtInk
export type ColoringArt = z.infer<typeof artSchema>

/** Axis-aligned rectangle in art (viewBox) units. */
export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** What `GET /api/coloring/arts/:id` returns: the art the editor draws on. */
export interface ArtDetails {
  id: string
  title: string
  art: ColoringArt
  /** Share of a region that counts it as coloured, as the administrator set it. */
  tolerance: number
}
