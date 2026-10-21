import { z } from 'zod'
import { ART_TITLE_MAX_LENGTH, GALLERY_PAGE_SIZE, PERCENT_MAX } from './constants'

/**
 * Keyset cursor: the `seq` of the last card of the previous page. The client treats it as an
 * opaque string; the server accepts only a positive integer written in digits.
 */
export const galleryQuerySchema = z.object({
  cursor: z.string().regex(/^[1-9]\d{0,15}$/, 'Некорректный курсор').optional(),
})

/** Name of an imported file, reduced to a safe title. */
export const importQuerySchema = z.object({
  name: z.string().trim().max(200).optional(),
})

export const galleryItemSchema = z.object({
  id: z.uuid(),
  title: z.string().max(ART_TITLE_MAX_LENGTH),
  source: z.enum(['builtin', 'user']),
  /** Whole percent of the current attempt, 0 when not started. */
  percent: z.number().int().min(0).max(PERCENT_MAX),
  attempt: z.number().int().min(0),
  completed: z.boolean(),
  /** When the thumbnail of the painted picture was stored (ms since the epoch); null while there is none. */
  thumbnail: z.number().int().nullable(),
})

export const galleryPageSchema = z.object({
  items: z.array(galleryItemSchema).max(GALLERY_PAGE_SIZE),
  /** Pass as `cursor` to get the next page; null on the last page. */
  nextCursor: z.string().nullable(),
})
