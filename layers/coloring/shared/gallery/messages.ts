import { IMPORT_LIMIT } from './constants'

/** Errors of the gallery API that are not platform-wide. */
export const GALLERY_ERROR_MESSAGES = {
  import_limit_reached: `Можно хранить не больше ${IMPORT_LIMIT} своих рисунков. Удалите ненужный и попробуйте снова.`,
  svg_rejected: 'Не удалось импортировать файл.',
  svg_not_utf8: 'Файл должен быть SVG в кодировке UTF-8.',
} as const

export type GalleryErrorCode = keyof typeof GALLERY_ERROR_MESSAGES
