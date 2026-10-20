import { canvasToPng, context2d, createCanvas, releaseCanvas, type AnyCanvas, type AnyContext } from './canvas'
import { drawInk, type ArtGeometry } from './geometry'
import type { ArtSpace } from './space'

/**
 * Renders the finished picture without any UI: paint on white, with the art
 * layer multiplied on top, exactly as the stage shows it. Ink is drawn from
 * vectors, so lines stay crisp at export resolution.
 *
 * The art layer never changes, so it is rendered once; both canvases are
 * reused between exports to keep memory flat on iOS.
 */
export class Exporter {
  private art: AnyCanvas | null = null
  private output: AnyCanvas | null = null
  private outputContext: AnyContext | null = null

  constructor(private readonly space: ArtSpace, private readonly geometry: ArtGeometry) {}

  toPng(paint: AnyCanvas): Promise<Blob> {
    const { paintWidth, paintHeight } = this.space
    if (!this.output || !this.outputContext) {
      this.output = createCanvas(paintWidth, paintHeight)
      this.outputContext = context2d(this.output)
    }
    const ctx = this.outputContext
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, paintWidth, paintHeight)
    ctx.drawImage(paint, 0, 0)
    ctx.globalCompositeOperation = 'multiply'
    ctx.drawImage(this.artLayer(), 0, 0)
    return canvasToPng(this.output)
  }

  dispose() {
    if (this.art) releaseCanvas(this.art)
    if (this.output) releaseCanvas(this.output)
  }

  private artLayer(): AnyCanvas {
    if (this.art) return this.art
    this.art = createCanvas(this.space.paintWidth, this.space.paintHeight)
    const ctx = context2d(this.art)
    ctx.setTransform(...this.space.artToPaintTransform)
    for (const item of this.geometry.items) {
      if (item.type === 'region') {
        ctx.fillStyle = '#fff'
        ctx.fill(item.path, item.fillRule)
      }
      else {
        drawInk(ctx, item)
      }
    }
    return this.art
  }
}
