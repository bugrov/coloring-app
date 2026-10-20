import type { ColoringArt } from './art'

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

export type SvgErrorCode
  = | 'too-large'
    | 'doctype-not-allowed'
    | 'malformed'
    | 'not-svg'
    | 'too-many-elements'
    | 'no-dimensions'
    | 'no-regions'
    | 'too-many-regions'
    | 'timeout'
    | 'invalid-svg'

export type SvgWarningCode
  = | 'unsupported-element'
    | 'unsupported-paint'
    | 'ignored-effect'
    | 'ignored-dash'
    | 'external-reference'
    | 'invalid-path'
    | 'path-too-long'

export interface SvgWarning {
  code: SvgWarningCode
  /** Element or value the warning is about, for diagnostics. */
  detail?: string
}

export type SvgConversion
  = | { ok: true, art: ColoringArt, warnings: SvgWarning[] }
    | { ok: false, error: SvgErrorCode, detail?: string }
