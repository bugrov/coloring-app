import type { z } from 'zod'
import type { galleryItemSchema, galleryPageSchema } from '../gallery/schema'

export type GalleryItem = z.infer<typeof galleryItemSchema>
export type GalleryPage = z.infer<typeof galleryPageSchema>
