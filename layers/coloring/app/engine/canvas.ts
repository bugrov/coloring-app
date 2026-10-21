export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas
export type AnyContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

/** Paint-pixel rectangle. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Offscreen canvases where supported (all current browsers), DOM canvases otherwise. */
export function createCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export function context2d(canvas: AnyCanvas, options?: CanvasRenderingContext2DSettings): AnyContext {
  const ctx = canvas.getContext('2d', options) as AnyContext | null
  if (!ctx) throw new Error('Canvas 2D is not available')
  return ctx
}

/** Frees a canvas' pixel memory now instead of whenever it is garbage collected (iOS has a hard total limit). */
export function releaseCanvas(canvas: AnyCanvas) {
  canvas.width = 0
  canvas.height = 0
}

/** Copies a rectangle from one canvas to the same place on another. */
export function copyRect(target: AnyContext, source: AnyCanvas, { x, y, width, height }: Rect) {
  target.drawImage(source, x, y, width, height, x, y, width, height)
}

export function canvasToBlob(canvas: AnyCanvas, type: string, quality?: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality })
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Image encoding failed'))), type, quality)
  })
}

export function canvasToPng(canvas: AnyCanvas): Promise<Blob> {
  return canvasToBlob(canvas, 'image/png')
}

/** Smallest rectangle covering both, or the other one when either is empty. */
export function unionRect(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b
  if (!b) return a
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y }
}

/** Intersection snapped outwards to whole pixels; null when empty. */
export function intersectRect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(Math.floor(a.x), Math.floor(b.x))
  const y = Math.max(Math.floor(a.y), Math.floor(b.y))
  const right = Math.min(Math.ceil(a.x + a.width), Math.ceil(b.x + b.width))
  const bottom = Math.min(Math.ceil(a.y + a.height), Math.ceil(b.y + b.height))
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null
}
