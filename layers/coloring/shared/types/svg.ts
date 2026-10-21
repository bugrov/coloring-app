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
  /** Output items (regions and line art) in total. */
  maxItems: number
  /** Characters of path data in the whole output. */
  maxOutputLength: number
  /** Characters of CSS in <style> blocks; longer CSS is ignored. */
  maxCssLength: number
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
    | 'invalid-dimensions'
    | 'too-complex'
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
    | 'ignored-styles'
    | 'invalid-transform'

export interface SvgWarning {
  code: SvgWarningCode
  /** Element or value the warning is about, for diagnostics. */
  detail?: string
}

export type SvgConversion
  = | { ok: true, art: ColoringArt, warnings: SvgWarning[] }
    | { ok: false, error: SvgErrorCode, detail?: string }
