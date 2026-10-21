import { DOMParser, type Element } from '@xmldom/xmldom'
import { ART_FORMAT_VERSION, artSchema, isValidPathData } from '../art'
import type { ArtItem, Bounds, ColoringArt, SvgConversion, SvgErrorCode, SvgLimits, SvgWarning, SvgWarningCode } from '../types'
import { parseColor, relativeLuminance, toHex, type Rgb } from './color'
import { processPath } from './geometry'
import { ceilTo, floorTo, roundTo } from './number'
import { IDENTITY, matrixScale, multiply, parseTransform, translation, type Matrix } from './transform'
import {
  BACKGROUND_TOLERANCE,
  DEFAULT_SVG_LIMITS,
  DETAIL_MAX_LENGTH,
  INK_LUMINANCE_MAX,
  MAX_MITER_LIMIT,
  MAX_NESTING_DEPTH,
  MAX_TRANSFORM_LENGTH,
  MAX_USE_DEPTH,
  MAX_VISITS_PER_ELEMENT,
  MIN_REGION_SIZE,
  OUTPUT_ALLOWANCE,
  OUTPUT_PER_SOURCE_BYTE,
  PROCESSED_PER_SOURCE_BYTE,
  PATH_PRECISION,
  VIEWBOX_MAX_ASPECT,
  VIEWBOX_MAX_SIZE,
  VIEWBOX_MIN_SIZE,
} from './constants'
import { numberAttr, SHAPE_ELEMENTS, shapeToPath } from './shapes'
import { INITIAL_STYLE, parseClassRules, resolveStyle, type StyleDeclarations } from './style'

class SvgConversionError extends Error {
  constructor(readonly code: SvgErrorCode, readonly detail?: string) {
    super(code)
  }
}

/** Containers whose content only renders when referenced, plus metadata. */
const NON_RENDERED = new Set([
  'defs', 'clipPath', 'mask', 'pattern', 'linearGradient', 'radialGradient', 'filter',
  'symbol', 'marker', 'title', 'desc', 'metadata', 'style',
])

/** Content that cannot become colourable regions; reported to the user. */
const UNSUPPORTED = new Set(['text', 'image', 'foreignObject', 'script', 'video', 'audio', 'iframe', 'canvas'])

const GROUPS = new Set(['g', 'a', 'switch', 'svg'])

/** Shapes that enclose an area even without an explicit close command. */
const ALWAYS_CLOSED = new Set(['rect', 'circle', 'ellipse', 'polygon'])

type Paint
  = | { kind: 'none' }
    | { kind: 'color', rgb: Rgb }
  /** Gradients, patterns and unknown colour names. */
    | { kind: 'unsupported', value: string }

interface Context {
  /** Accumulated transform from the element to the root. */
  matrix: Matrix
  style: StyleDeclarations
  useDepth: number
  /** Element nesting depth, including expanded <use> references. */
  depth: number
}

/**
 * Converts an untrusted SVG document into a {@link ColoringArt}. Never throws:
 * any problem is reported as an error code the UI can explain to the user.
 */
export function convertSvg(source: string, limits: SvgLimits = DEFAULT_SVG_LIMITS): SvgConversion {
  try {
    return { ok: true, ...new SvgConverter(limits).convert(source) }
  }
  catch (error) {
    if (error instanceof SvgConversionError) {
      return { ok: false, error: error.code, ...(error.detail ? { detail: error.detail } : {}) }
    }
    return { ok: false, error: 'invalid-svg' }
  }
}

class SvgConverter {
  private readonly items: ArtItem[] = []
  private readonly warnings = new Map<string, SvgWarning>()
  private readonly ids = new Map<string, Element>()
  private classRules = new Map<string, StyleDeclarations>()
  private viewBox: [number, number, number, number] = [0, 0, 1, 1]
  private longSide = 1
  private regionCount = 0
  private hasBackground = false
  private deadline = 0
  private visits = 0
  private outputLength = 0
  /** Path data processed so far; re-used shapes count every time. */
  private processedLength = 0
  private processedLimit = 0
  private outputLimit = 0

  constructor(private readonly limits: SvgLimits) {}

  convert(source: string): { art: ColoringArt, warnings: SvgWarning[] } {
    this.deadline = Date.now() + this.limits.timeBudgetMs
    // The result may be larger than the source (absolute coordinates, expanded
    // shapes), but not by an arbitrary factor: that would be amplification.
    this.outputLimit = Math.min(this.limits.maxOutputLength, source.length * OUTPUT_PER_SOURCE_BYTE + OUTPUT_ALLOWANCE)
    this.processedLimit = source.length * PROCESSED_PER_SOURCE_BYTE + OUTPUT_ALLOWANCE

    if (new TextEncoder().encode(source).length > this.limits.maxBytes) {
      throw new SvgConversionError('too-large')
    }
    // DTDs enable entity expansion (billion laughs) and external entities (XXE).
    // Design tools never emit them, so they are rejected outright.
    if (/<!DOCTYPE|<!ENTITY/i.test(source)) {
      throw new SvgConversionError('doctype-not-allowed')
    }

    const root = this.parse(stripBom(source))
    this.indexDocument(root)
    this.checkDeadline()
    this.viewBox = readViewBox(root)
    this.longSide = Math.max(this.viewBox[2], this.viewBox[3])

    const style = resolveStyle(root, INITIAL_STYLE, this.classRules)
    for (const child of childElements(root)) {
      this.visit(child, { matrix: IDENTITY, style, useDepth: 0, depth: 1 })
    }

    if (this.regionCount === 0) throw new SvgConversionError('no-regions')

    const [x, y, width, height] = this.viewBox
    if (!this.hasBackground) {
      this.items.unshift({
        type: 'region',
        id: 0,
        kind: 'background',
        d: `M${x} ${y}H${x + width}V${y + height}H${x}Z`,
        fillRule: 'nonzero',
        bounds: [x, y, x + width, y + height],
      })
    }

    let nextId = 1
    for (const item of this.items) {
      if (item.type === 'region') item.id = nextId++
    }

    this.checkDeadline()
    const art = artSchema.parse({ version: ART_FORMAT_VERSION, viewBox: this.viewBox, items: this.items })
    return { art, warnings: [...this.warnings.values()] }
  }

  private parse(source: string): Element {
    let document
    try {
      document = new DOMParser({
        onError: (level, message) => {
          if (level !== 'warning') throw new SvgConversionError('malformed', safeDetail(message))
        },
      }).parseFromString(source, 'image/svg+xml')
    }
    catch {
      throw new SvgConversionError('malformed')
    }

    const root = document.documentElement
    if (!root || root.localName !== 'svg') throw new SvgConversionError('not-svg')
    return root
  }

  private indexDocument(root: Element) {
    const all = root.getElementsByTagName('*')
    if (all.length + 1 > this.limits.maxElements) throw new SvgConversionError('too-many-elements')

    const css: string[] = []
    let cssLength = 0
    for (let i = 0; i < all.length; i++) {
      const element = all.item(i)!
      const id = element.getAttribute('id')
      if (id && !this.ids.has(id)) this.ids.set(id, element)
      if (element.localName === 'style') {
        const text = element.textContent ?? ''
        cssLength += text.length
        css.push(text)
      }
    }
    if (cssLength > this.limits.maxCssLength) this.warn('ignored-styles')
    else this.classRules = parseClassRules(css.join('\n'))
  }

  private checkDeadline() {
    if (Date.now() > this.deadline) throw new SvgConversionError('timeout')
  }

  private warn(code: SvgWarningCode, detail?: string) {
    const safe = detail === undefined ? '' : safeDetail(detail)
    this.warnings.set(`${code}:${safe}`, safe ? { code, detail: safe } : { code })
  }

  private visit(element: Element, parent: Context) {
    this.checkDeadline()
    if (++this.visits > this.limits.maxElements * MAX_VISITS_PER_ELEMENT || parent.depth > MAX_NESTING_DEPTH) {
      throw new SvgConversionError('too-complex')
    }

    const tag = element.localName ?? ''
    if (NON_RENDERED.has(tag)) return
    if (UNSUPPORTED.has(tag)) {
      this.warn('unsupported-element', tag)
      return
    }

    const style = resolveStyle(element, parent.style, this.classRules)
    if (style.display === 'none' || Number.parseFloat(style.opacity ?? '1') === 0) return
    for (const effect of ['mask', 'filter'] as const) {
      if (style[effect] && style[effect] !== 'none') this.warn('ignored-effect', effect)
    }

    const context: Context = {
      matrix: this.elementMatrix(element, parent.matrix),
      style,
      useDepth: parent.useDepth,
      depth: parent.depth + 1,
    }

    if (tag === 'use') this.visitUse(element, context)
    else if (GROUPS.has(tag)) this.visitChildren(element, context)
    else if (SHAPE_ELEMENTS.has(tag)) this.emitShape(element, tag, context)
  }

  private visitChildren(element: Element, context: Context) {
    for (const child of childElements(element)) this.visit(child, context)
  }

  private visitUse(element: Element, context: Context) {
    const href = element.getAttribute('href') ?? element.getAttribute('xlink:href') ?? ''
    if (!href.startsWith('#')) {
      this.warn('external-reference', href)
      return
    }
    const target = this.ids.get(href.slice(1))
    if (!target || context.useDepth >= MAX_USE_DEPTH) return

    const x = numberAttr(element, 'x')
    const y = numberAttr(element, 'y')
    const referenced: Context = {
      ...context,
      matrix: x || y ? multiply(context.matrix, translation(x, y)) : context.matrix,
      useDepth: context.useDepth + 1,
    }
    if (target.localName === 'symbol') this.visitChildren(target, referenced)
    else this.visit(target, referenced)
  }

  /** The element's own transform composed with its parent's; malformed transforms are ignored, as browsers do. */
  private elementMatrix(element: Element, parent: Matrix): Matrix {
    const value = element.getAttribute('transform')?.trim()
    if (!value) return parent
    const own = value.length <= MAX_TRANSFORM_LENGTH ? parseTransform(value) : null
    if (!own) {
      this.warn('invalid-transform', element.localName ?? '')
      return parent
    }
    return multiply(parent, own)
  }

  private emitShape(element: Element, tag: string, { matrix, style }: Context) {
    if (style.visibility === 'hidden' || style.visibility === 'collapse') return

    // Checked before any parsing or splitting: their cost grows with length.
    const max = this.limits.maxPathLength
    if ((element.getAttribute(tag === 'path' ? 'd' : 'points') ?? '').length > max) {
      this.warn('path-too-long', tag)
      return
    }
    const raw = shapeToPath(element)
    if (!raw) return
    if (raw.length > max) {
      this.warn('path-too-long', tag)
      return
    }
    this.emitPath(raw, tag, matrix, style)
  }

  private emitPath(raw: string, tag: string, matrix: Matrix, style: StyleDeclarations) {
    // Processing far more path data than the file holds means heavy <use>
    // re-use, so stop before doing the work.
    this.processedLength += raw.length
    if (this.processedLength > this.processedLimit) {
      throw new SvgConversionError('too-complex')
    }

    // The tokenizer keeps the valid part before any junk (as browsers do) and emits only commands and numbers.
    const processed = processPath(raw, matrix, PATH_PRECISION)
    // Extreme transforms can produce Infinity or NaN coordinates.
    if (!processed || !isValidPathData(processed.d)) {
      this.warn('invalid-path', tag)
      return
    }
    const { d, bounds, closed, truncated } = processed
    if (truncated) this.warn('truncated-path', tag)
    if (d.length > this.limits.maxPathLength) {
      this.warn('path-too-long', tag)
      return
    }

    // Lines have no interior, whatever their fill says; neither do degenerate shapes.
    const hasInterior = tag !== 'line' && this.hasArea(bounds)
    const fillRule = style['fill-rule'] === 'evenodd' ? 'evenodd' : 'nonzero'
    const fill = hasInterior ? this.paint(style.fill, style.color, style['fill-opacity']) : { kind: 'none' as const }
    const stroke = this.paint(style.stroke, style.color, style['stroke-opacity'])
    const strokeWidth = Math.min(this.longSide, (Number.parseFloat(style['stroke-width'] ?? '1') || 0) * matrixScale(matrix))
    const hasStroke = stroke.kind !== 'none' && Number.isFinite(strokeWidth) && strokeWidth > 0

    if (hasStroke && style['stroke-dasharray'] && style['stroke-dasharray'] !== 'none') {
      this.warn('ignored-dash')
    }

    const coversCanvas = fill.kind !== 'none' && this.isBackground(bounds)
    const isInkFill = fill.kind === 'color' && relativeLuminance(fill.rgb) <= INK_LUMINANCE_MAX && !coversCanvas
    const isRegion = hasInterior && !isInkFill && (fill.kind !== 'none' || (hasStroke && (closed || ALWAYS_CLOSED.has(tag))))

    if (isRegion) {
      if (fill.kind === 'unsupported') this.warn('unsupported-paint', fill.value)
      this.addRegion(d, fillRule, coversCanvas, bounds!)
    }

    if (isInkFill || hasStroke) {
      this.emit({
        type: 'ink',
        d,
        fillRule,
        fill: isInkFill && fill.kind === 'color' ? toHex(fill.rgb) : null,
        stroke: hasStroke ? this.inkColor(stroke) : null,
        strokeWidth: hasStroke ? roundTo(strokeWidth, PATH_PRECISION) : 0,
        lineCap: oneOf(style['stroke-linecap'], ['butt', 'round', 'square'] as const, 'butt'),
        lineJoin: oneOf(style['stroke-linejoin'], ['miter', 'round', 'bevel'] as const, 'miter'),
        miterLimit: Math.min(MAX_MITER_LIMIT, Math.max(1, Number.parseFloat(style['stroke-miterlimit'] ?? '4') || 4)),
      })
    }
  }

  /** Adds an output item, enforcing limits on the size of the result. */
  private emit(item: ArtItem) {
    // The stored size: path data plus every other field of the item.
    this.outputLength += JSON.stringify(item).length
    if (this.items.length >= this.limits.maxItems || this.outputLength > this.outputLimit) {
      throw new SvgConversionError('too-complex')
    }
    this.items.push(item)
  }

  /** Whether the shape is large enough on both axes to be seen and coloured. */
  private hasArea(bounds: Bounds | null): boolean {
    if (!bounds) return false
    const minSize = this.longSide * MIN_REGION_SIZE
    return bounds.maxX - bounds.minX > minSize && bounds.maxY - bounds.minY > minSize
  }

  private addRegion(d: string, fillRule: 'nonzero' | 'evenodd', coversCanvas: boolean, { minX, minY, maxX, maxY }: Bounds) {
    // Only the first full-canvas shape (a Figma frame fill, typically) is the
    // background; later ones are ordinary areas.
    const kind = coversCanvas && !this.hasBackground && this.regionCount === 0 ? 'background' : 'area'
    if (kind === 'background') {
      this.hasBackground = true
    }
    else if (++this.regionCount > this.limits.maxRegions) {
      throw new SvgConversionError('too-many-regions')
    }
    // Rounded outwards so the bounds stay an upper bound of the shape.
    const bounds: [number, number, number, number] = [
      floorTo(minX, PATH_PRECISION),
      floorTo(minY, PATH_PRECISION),
      ceilTo(maxX, PATH_PRECISION),
      ceilTo(maxY, PATH_PRECISION),
    ]
    this.emit({ type: 'region', id: 0, kind, d, fillRule, bounds })
  }

  private isBackground(bounds: Bounds | null): boolean {
    if (!bounds) return false
    const [x, y, width, height] = this.viewBox
    const dx = width * BACKGROUND_TOLERANCE
    const dy = height * BACKGROUND_TOLERANCE
    return bounds.minX <= x + dx && bounds.minY <= y + dy
      && bounds.maxX >= x + width - dx && bounds.maxY >= y + height - dy
  }

  private paint(value: string | undefined, currentColor: string | undefined, opacity: string | undefined): Paint {
    if (!value || value === 'none' || value === 'transparent') return { kind: 'none' }
    if (Number.parseFloat(opacity ?? '1') === 0) return { kind: 'none' }
    const resolved = value === 'currentColor' ? (currentColor ?? '#000000') : value
    const rgb = parseColor(resolved)
    return rgb ? { kind: 'color', rgb } : { kind: 'unsupported', value }
  }

  /** Strokes are always line art; paints we cannot resolve are drawn black. */
  private inkColor(stroke: Paint): string {
    if (stroke.kind === 'color') return toHex(stroke.rgb)
    if (stroke.kind === 'unsupported') this.warn('unsupported-paint', stroke.value)
    return '#000000'
  }
}

function childElements(element: Element): Element[] {
  const children: Element[] = []
  for (let node = element.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === node.ELEMENT_NODE) children.push(node as Element)
  }
  return children
}

function readViewBox(root: Element): [number, number, number, number] {
  const parts = (root.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number)
  if (parts.length === 4 && parts.every(Number.isFinite) && parts[2]! > 0 && parts[3]! > 0) {
    return checkDimensions(parts as [number, number, number, number])
  }
  const width = numberAttr(root, 'width')
  const height = numberAttr(root, 'height')
  if (width > 0 && height > 0) return checkDimensions([0, 0, width, height])
  throw new SvgConversionError('no-dimensions')
}

function checkDimensions(viewBox: [number, number, number, number]): [number, number, number, number] {
  const [x, y, width, height] = viewBox
  if (!isSizeInRange(width) || !isSizeInRange(height) || Math.abs(x) > VIEWBOX_MAX_SIZE || Math.abs(y) > VIEWBOX_MAX_SIZE
    || Math.max(width / height, height / width) > VIEWBOX_MAX_ASPECT) {
    throw new SvgConversionError('invalid-dimensions')
  }
  return viewBox
}

function isSizeInRange(size: number): boolean {
  return size >= VIEWBOX_MIN_SIZE && size <= VIEWBOX_MAX_SIZE
}

/** Keeps only characters that cannot form markup or URLs, so details are safe to display anywhere. */
function safeDetail(value: string): string {
  return value.replace(/[^\w#().,%-]/g, '').slice(0, DETAIL_MAX_LENGTH)
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback
}

const BYTE_ORDER_MARK = 0xFE_FF

function stripBom(source: string): string {
  return source.charCodeAt(0) === BYTE_ORDER_MARK ? source.slice(1) : source
}
