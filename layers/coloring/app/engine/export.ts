import { canvasToBlob, canvasToPng, context2d, createCanvas, releaseCanvas, type AnyCanvas } from './canvas'
import { drawArt, type ArtGeometry } from './geometry'
import type { ArtSpace } from './space'

/** WebP quality of a thumbnail: small files, still clean lines. */
const THUMBNAIL_QUALITY = 0.82

/**
 * Draws the picture at `scale` times the paint size (paint on white, the art layer multiplied on
 * top, as the stage shows it) and encodes it. Ink is drawn from vectors at the target size, so
 * lines stay crisp. Both canvases exist only for the duration of the call and are released right
 * after encoding: iOS limits total canvas memory.
 */
async function renderPicture(space: ArtSpace, geometry: ArtGeometry, paint: AnyCanvas, scale: number, encode: (canvas: AnyCanvas) => Promise<Blob>): Promise<Blob> {
  const width = Math.max(1, Math.round(space.paintWidth * scale))
  const height = Math.max(1, Math.round(space.paintHeight * scale))
  const art = createCanvas(width, height)
  const output = createCanvas(width, height)

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

    return await encode(output)
  } finally {
    releaseCanvas(art)
    releaseCanvas(output)
  }
}

/** The finished picture without any UI, at the paint canvas' own size. */
export function exportPng(space: ArtSpace, geometry: ArtGeometry, paint: AnyCanvas): Promise<Blob> {
  return renderPicture(space, geometry, paint, 1, canvas => canvasToPng(canvas))
}

/**
 * A small WebP of the picture for the gallery card, `longSide` pixels along its long side. The
 * browser falls back to PNG where it cannot encode WebP; the server takes both.
 */
export function exportThumbnail(space: ArtSpace, geometry: ArtGeometry, paint: AnyCanvas, longSide: number): Promise<Blob> {
  const scale = longSide / Math.max(space.paintWidth, space.paintHeight)

  return renderPicture(space, geometry, paint, scale, canvas => canvasToBlob(canvas, 'image/webp', THUMBNAIL_QUALITY))
}
