import { ZOOM_MAX, ZOOM_MIN } from './constants'

/** Zoom and pan of the art inside its stage; translation in CSS pixels. */
export interface View {
  scale: number
  x: number
  y: number
}

export const IDENTITY_VIEW: Readonly<View> = { scale: 1, x: 0, y: 0 }

function clampScale(scale: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale))
}

/**
 * Keeps the art covering the stage: at scale s the content is s times the
 * stage, so the translation must stay within [size * (1 - s), 0].
 */
export function clampView(view: View, width: number, height: number): View {
  const scale = clampScale(view.scale)
  const clamp = (value: number, size: number) => Math.min(0, Math.max(size * (1 - scale), value))
  return { scale, x: clamp(view.x, width), y: clamp(view.y, height) }
}

/** Zooms by `factor` keeping the stage point (px, py) under the same content point. */
export function zoomAt(view: View, factor: number, px: number, py: number, width: number, height: number): View {
  const scale = clampScale(view.scale * factor)
  const ratio = scale / view.scale
  return clampView({ scale, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio }, width, height)
}

export function panBy(view: View, dx: number, dy: number, width: number, height: number): View {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy }, width, height)
}
