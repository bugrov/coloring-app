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

/** The part of the stage's content that may be brought into view, in content pixels at scale 1. */
export interface Area {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The offset along one axis. The area must cover the stage (its edges are not let into the stage), so the
 * offset stays within [size - scale * (start + length), -scale * start]; an area smaller than the stage
 * has no room to move and sits in the middle.
 */
function clampOffset(value: number, size: number, scale: number, start: number, length: number): number {
  const min = size - scale * (start + length)
  const max = -scale * start

  // `+ 0` turns a negative zero (from -scale * 0) into a plain one.
  return (min > max ? (min + max) / 2 : Math.min(max, Math.max(min, value))) + 0
}

/**
 * Keeps `area` (all of the content when absent) covering the stage: at scale s the content is s times the
 * stage, so for the whole content the translation stays within [size * (1 - s), 0]. A sheet wider than a
 * narrow stage is an area bigger than the stage, so it can be moved even at scale 1.
 */
export function clampView(view: View, width: number, height: number, area: Area = { x: 0, y: 0, width, height }): View {
  const scale = clampScale(view.scale)

  return {
    scale,
    x: clampOffset(view.x, width, scale, area.x, area.width),
    y: clampOffset(view.y, height, scale, area.y, area.height),
  }
}

/** Zooms by `factor` keeping the stage point (px, py) under the same content point. */
export function zoomAt(view: View, factor: number, px: number, py: number, width: number, height: number, area?: Area): View {
  const scale = clampScale(view.scale * factor)
  const ratio = scale / view.scale

  return clampView({ scale, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio }, width, height, area)
}

export function panBy(view: View, dx: number, dy: number, width: number, height: number, area?: Area): View {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy }, width, height, area)
}
