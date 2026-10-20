import { canvasToPng, context2d, createCanvas, releaseCanvas, type AnyCanvas } from './canvas'
import { drawInk, type ArtGeometry } from './geometry'
import type { ArtSpace } from './space'

/**
 * The finished picture without any UI: paint on white, with the art layer
 * multiplied on top, exactly as the stage shows it. Ink is drawn from
 * vectors, so lines stay crisp at export resolution.
 *
 * Both full-size canvases exist only for the duration of the export and are
 * released right after encoding: iOS limits total canvas memory.
 */
export async function exportPng(space: ArtSpace, geometry: ArtGeometry, paint: AnyCanvas): Promise<Blob> {
  const art = createCanvas(space.paintWidth, space.paintHeight)
  const output = createCanvas(space.paintWidth, space.paintHeight)
  try {
    const artContext = context2d(art)
    artContext.setTransform(...space.artToPaintTransform)
    for (const item of geometry.items) {
      if (item.type === 'region') {
        artContext.fillStyle = '#fff'
        artContext.fill(item.path, item.fillRule)
      }
      else {
        drawInk(artContext, item)
      }
    }

    const ctx = context2d(output)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, space.paintWidth, space.paintHeight)
    ctx.drawImage(paint, 0, 0)
    ctx.globalCompositeOperation = 'multiply'
    ctx.drawImage(art, 0, 0)
    return await canvasToPng(output)
  }
  finally {
    releaseCanvas(art)
    releaseCanvas(output)
  }
}
