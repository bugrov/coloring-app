import { z } from 'zod'
import { ART_TITLE_MAX_LENGTH, GALLERY_PAGE_SIZE } from './constants'

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
  percent: z.number().int().min(0).max(100),
  attempt: z.number().int().min(0),
  completed: z.boolean(),
})

export const galleryPageSchema = z.object({
  items: z.array(galleryItemSchema).max(GALLERY_PAGE_SIZE),
  /** Pass as `cursor` to get the next page; null on the last page. */
  nextCursor: z.string().nullable(),
})
