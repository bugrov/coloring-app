/** Cards per gallery request (keyset page). */
export const GALLERY_PAGE_SIZE = 12

/** Imported arts one player may keep. */
export const IMPORT_LIMIT = 20

/** Longest accepted title of an imported art (taken from the file name). */
export const ART_TITLE_MAX_LENGTH = 60

/** Title for an import whose file name gives nothing usable. */
export const DEFAULT_IMPORT_TITLE = 'Мой рисунок'

/** Progress, whole percent. A region counts as painted at the engine's own threshold. */
export const PERCENT_MAX = 100

/** Longest side of a gallery thumbnail of the painted picture, in pixels. */
export const THUMBNAIL_LONG_SIDE = 512

/** Largest thumbnail the server accepts, in bytes (a 512 px WebP is some 20-40 KB). */
export const THUMBNAIL_MAX_BYTES = 200_000
