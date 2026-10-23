import { canvasToBlob, canvasToPng, context2d, createCanvas, releaseCanvas, type AnyCanvas, type Rect } from './canvas'
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
async function renderPicture(space: ArtSpace, geometry: ArtGeometry, paint: AnyCanvas, scale: number, area: Rect, encode: (canvas: AnyCanvas) => Promise<Blob>): Promise<Blob> {
  const width = Math.max(1, Math.round(area.width * scale))
  const height = Math.max(1, Math.round(area.height * scale))
  const art = createCanvas(width, height)
  const output = createCanvas(width, height)

  try {
    const artContext = context2d(art)
    const [a, b, c, d, e, f] = space.artToPaintTransform

    // `area` is the part of the paint that is shown: the art's own transform moves it to the corner.
    artContext.setTransform(a * scale, b * scale, c * scale, d * scale, (e - area.x) * scale, (f - area.y) * scale)
    drawArt(artContext, geometry, () => '#fff')

    const ctx = context2d(output)

    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(paint, area.x, area.y, area.width, area.height, 0, 0, width, height)
    ctx.globalCompositeOperation = 'multiply'
    ctx.drawImage(art, 0, 0)

    return await encode(output)
  } finally {
    releaseCanvas(art)
    releaseCanvas(output)
  }
}

/** The part of the paint canvas that holds the art itself, without the sheet around it. */
function artArea(space: ArtSpace, paint: AnyCanvas): Rect {
  return {
    x: space.artPaintX,
    y: space.artPaintY,
    width: Math.min(paint.width - space.artPaintX, Math.round(space.width * space.paintScale)),
    height: Math.min(paint.height - space.artPaintY, Math.round(space.height * space.paintScale)),
  }
}

/**
 * The finished picture without any UI: the art itself at the paint canvas' own resolution. The sheet
 * around the art is left out: how much of it there is depends on how the device is held.
 */
export function exportPng(space: ArtSpace, geometry: ArtGeometry, paint: AnyCanvas): Promise<Blob> {
  return renderPicture(space, geometry, paint, 1, artArea(space, paint), canvas => canvasToPng(canvas))
}

/**
 * A small WebP of the picture for the gallery card, `longSide` pixels along its long side. The
 * browser falls back to PNG where it cannot encode WebP; the server takes both.
 */
export function exportThumbnail(space: ArtSpace, geometry: ArtGeometry, paint: AnyCanvas, longSide: number): Promise<Blob> {
  // The card shows the art itself, not the sheet around it.
  const area = artArea(space, paint)
  const scale = longSide / Math.max(area.width, area.height)

  return renderPicture(space, geometry, paint, scale, area, canvas => canvasToBlob(canvas, 'image/webp', THUMBNAIL_QUALITY))
}
