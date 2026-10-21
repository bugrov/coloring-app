import { ART_TITLE_MAX_LENGTH, DEFAULT_IMPORT_TITLE } from './constants'

/**
 * A title for an imported art from the uploaded file name: no extension, no path, no control
 * characters, collapsed spaces, at most `ART_TITLE_MAX_LENGTH`. The title is plain text and is
 * only ever rendered as text.
 */
export function titleFromFileName(name: string | undefined): string {
  const base = (name ?? '').split(/[\\/]/).pop() ?? ''
  // eslint-disable-next-line no-control-regex -- control characters are exactly what is removed
  const cleaned = base.replace(/\.svg$/i, '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim()
  return Array.from(cleaned).slice(0, ART_TITLE_MAX_LENGTH).join('') || DEFAULT_IMPORT_TITLE
}
