import type { SvgLimits } from '../types'

export const DEFAULT_SVG_LIMITS: SvgLimits = {
  maxBytes: 1_000_000,
  maxElements: 3000,
  maxRegions: 500,
  maxPathLength: 200_000,
  maxItems: 3000,
  maxOutputLength: 2_000_000,
  maxCssLength: 64_000,
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

/**
 * Elements visited per element in the document. <use> can revisit the same
 * subtree many times (symbol sheets do it legitimately); together with the
 * output and processed-data limits this bounds the work independently of the timer.
 */
export const MAX_VISITS_PER_ELEMENT = 20

/**
 * Path data processed per byte of the file (plus OUTPUT_ALLOWANCE). Shapes
 * expand when converted to paths (circles roughly double), so twice the file
 * size leaves room for that while still stopping heavy <use> re-use of big
 * paths early.
 */
export const PROCESSED_PER_SOURCE_BYTE = 2

/** Deeper nesting is rejected with a clear error instead of a stack overflow. */
export const MAX_NESTING_DEPTH = 256

/** Accepted viewBox sizes and proportions; outside them the engine cannot render sensibly. */
export const VIEWBOX_MIN_SIZE = 1e-3
export const VIEWBOX_MAX_SIZE = 1e6
export const VIEWBOX_MAX_ASPECT = 20

/** Regions thinner than this share of the long side are invisible and dropped. */
export const MIN_REGION_SIZE = 1e-4

/** Upper bound for stroke miter limits; real files use 1–10. */
export const MAX_MITER_LIMIT = 100

/** Warning details are diagnostics: short, and only characters that cannot form markup. */
export const DETAIL_MAX_LENGTH = 64

/** Longer `transform` attributes are ignored; real files use a few dozen characters. */
export const MAX_TRANSFORM_LENGTH = 2048

/** Longer `class` and `style` attributes are ignored; they are re-read on every <use> visit. */
export const MAX_STYLE_ATTRIBUTE_LENGTH = 4096

/**
 * Output path data may exceed the source this many times (absolute
 * coordinates, expanded shapes, moderate <use> re-use) plus a fixed allowance
 * for small files, and never maxOutputLength.
 */
export const OUTPUT_PER_SOURCE_BYTE = 4
export const OUTPUT_ALLOWANCE = 64_000
