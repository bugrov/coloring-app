import { canvasToBlob, canvasToPng, context2d, createCanvas, releaseCanvas, type AnyCanvas } from './canvas'
import { drawArt, type ArtGeometry } from './geometry'
import type { ArtSpace } from './space'

/** WebP quality of a thumbnail: small files, still clean lines. */
const THUMBNAIL_QUALITY = 0.82

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
    drawArt(artContext, geometry, () => '#fff')

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

/**
 * A small WebP of the picture for the gallery card, drawn at `longSide` pixels (the art layer
 * from vectors at that size, the paint scaled down). The browser falls back to PNG where it cannot
 * encode WebP; the server takes both.
 */
export async function exportThumbnail(space: ArtSpace, geometry: ArtGeometry, paint: AnyCanvas, longSide: number): Promise<Blob> {
  const scale = longSide / Math.max(space.paintWidth, space.paintHeight)
  const width = Math.max(1, Math.round(space.paintWidth * scale))
  const height = Math.max(1, Math.round(space.paintHeight * scale))
  const output = createCanvas(width, height)
  const art = createCanvas(width, height)
  try {
    const artContext = context2d(art)
    const [a, b, c, d, e, f] = space.artToPaintTransform
    artContext.setTransform(a * scale, b * scale, c * scale, d * scale, e * scale, f * scale)
    drawArt(artContext, geometry, () => '#fff')

    const ctx = context2d(output)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(paint, 0, 0, width, height)
    ctx.globalCompositeOperation = 'multiply'
    ctx.drawImage(art, 0, 0)
    return await canvasToBlob(output, 'image/webp', THUMBNAIL_QUALITY)
  }
  finally {
    releaseCanvas(art)
    releaseCanvas(output)
  }
}
