import { canvasToPng, context2d, createCanvas, type AnyCanvas } from './canvas'
import type { ArtGeometry } from './geometry'
import type { ArtSpace } from './space'

/**
 * The finished picture without any UI: paint on white, with the art layer
 * multiplied on top, exactly as the stage shows it. Ink is redrawn from
 * vectors, so lines stay crisp at export resolution.
 */
export function exportPng(space: ArtSpace, geometry: ArtGeometry, paint: AnyCanvas): Promise<Blob> {
  const art = createCanvas(space.paintWidth, space.paintHeight)
  const artContext = context2d(art)
  artContext.setTransform(...space.artToPaintTransform)
  for (const item of geometry.items) {
    if (item.type === 'region') {
      artContext.fillStyle = '#fff'
      artContext.fill(item.path, item.fillRule)
      continue
    }
    if (item.fill) {
      artContext.fillStyle = item.fill
      artContext.fill(item.path, item.fillRule)
    }
    if (item.stroke && item.strokeWidth > 0) {
      artContext.strokeStyle = item.stroke
      artContext.lineWidth = item.strokeWidth
      artContext.lineCap = item.lineCap
      artContext.lineJoin = item.lineJoin
      artContext.miterLimit = item.miterLimit
      artContext.stroke(item.path)
    }
  }

  const output = createCanvas(space.paintWidth, space.paintHeight)
  const ctx = context2d(output)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, space.paintWidth, space.paintHeight)
  ctx.drawImage(paint, 0, 0)
  ctx.globalCompositeOperation = 'multiply'
  ctx.drawImage(art, 0, 0)
  return canvasToPng(output)
}
