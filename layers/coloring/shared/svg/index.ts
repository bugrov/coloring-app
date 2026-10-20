// Public API of the SVG import pipeline. Parsing helpers (geometry, shapes,
// style) are internal and imported directly only by their tests.
export { parseColor, type Rgb } from './color'
export { DEFAULT_SVG_LIMITS } from './constants'
export { SVG_ERROR_MESSAGES, SVG_WARNING_MESSAGES } from './messages'
export { convertSvg } from './pipeline'
