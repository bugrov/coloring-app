/** Hard limits for imported SVG files; they bound memory and CPU per import. */
export interface SvgLimits {
  /** Source size in bytes (UTF-8). */
  maxBytes: number
  /** Element nodes in the document, including unsupported ones. */
  maxElements: number
  /** Colourable regions in the result. */
  maxRegions: number
  /** Characters of path data in a single output item. */
  maxPathLength: number
  /** Wall-clock budget for the whole conversion. */
  timeBudgetMs: number
}

export const DEFAULT_SVG_LIMITS: SvgLimits = {
  maxBytes: 1_000_000,
  maxElements: 3000,
  maxRegions: 500,
  maxPathLength: 200_000,
  timeBudgetMs: 2000,
}

/** Fills darker than this relative luminance are line art, not regions. */
export const INK_LUMINANCE_MAX = 0.2

/** Output coordinates are rounded to this many decimals. */
export const PATH_PRECISION = 2

/** A rect within this share of the viewBox size counts as the background. */
export const BACKGROUND_TOLERANCE = 0.01

/** Nested <use> references deeper than this are dropped (cycles, bombs). */
export const MAX_USE_DEPTH = 8
