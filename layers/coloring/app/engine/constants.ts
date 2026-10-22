import type { Tool } from '../../shared'

/**
 * Paint canvas resolution along the art's long side. Fixed (not tied to the
 * device pixel ratio) so memory is predictable on iOS, zoom stays sharp up to
 * ~2x on phones, and the export uses the same pixels.
 */
export const PAINT_LONG_SIDE = 2048

/** Line widths as a share of the art's long side. */
export const TOOL_WIDTH: Record<Tool, number> = {
  pencil: 0.008,
  brush: 0.03,
  eraser: 0.03,
}

/**
 * What the player can multiply a tool's line width by: thin, normal, thick. The result is stored
 * in each stroke op as its width, so replay needs no knowledge of these.
 */
export const THICKNESS_SCALES = [0.5, 1, 1.8] as const
export const DEFAULT_THICKNESS: number = THICKNESS_SCALES[1]

/** Distance between brush stamps as a share of the brush diameter. */
export const BRUSH_STAMP_SPACING = 0.15

/** Opaque core of the brush stamp; the rest of the radius fades out. */
export const BRUSH_HARDNESS = 0.6

/**
 * Pencil grain: an opaque tile where each pixel is the colour lightened
 * towards white by up to this share. Opaque on purpose: overlapping parts of
 * a stroke then look the same however often they are drawn, so live drawing
 * and replay match.
 */
export const PENCIL_GRAIN_TILE = 64
export const PENCIL_GRAIN_LIGHTEN = 0.35

/** Holding still this long fills (or clears) the whole region. */
export const HOLD_DURATION_MS = 450
/** Finger jitter allowed during a hold, in CSS pixels. */
export const HOLD_TOLERANCE_PX = 6
/** Short haptic tick when a hold fills a region (Android; ignored elsewhere). */
export const HOLD_VIBRATION_MS = 15

/** Mouse buttons that drag the zoomed art instead of drawing: the middle (1) and the right (2) one. */
export const PAN_BUTTONS: readonly number[] = [1, 2]

/** Progress grid resolution along the art's long side. */
export const PROGRESS_GRID_LONG_SIDE = 256
/**
 * A paint pixel counts as painted from this alpha (0–255); a grid cell is
 * painted when at least half of its sampled pixels are. Just under 25%
 * opacity (64), the faintest preset, so even that paint counts.
 */
export const PAINTED_ALPHA_MIN = 60
/** Every n-th paint pixel per axis is sampled inside a cell: 16 samples per 8×8 block. */
export const PROGRESS_SAMPLE_STEP = 2
/** A region this covered counts as fully coloured, so 100% is reachable by hand. */
export const REGION_COMPLETE_RATIO = 0.95

export const ZOOM_MIN = 1
export const ZOOM_MAX = 5
/** Zoom change per normalized wheel pixel (Ctrl+wheel, trackpad pinch). */
export const WHEEL_ZOOM_SPEED = 0.01
/** Wheel events in line mode are converted to pixels with this line height. */
export const WHEEL_LINE_HEIGHT_PX = 16
/**
 * Per-event caps. Trackpad pinches send small deltas and are not affected;
 * a mouse notch (~100 px) zooms by about 1.28x instead of jumping across the range.
 */
export const WHEEL_ZOOM_MAX_DELTA_PX = 25
export const WHEEL_PAN_MAX_DELTA_PX = 100
/** Fingers closer than this cannot define a pinch reliably. */
export const PINCH_MIN_DISTANCE_PX = 1
