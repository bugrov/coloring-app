import { DOMParser, type Element } from '@xmldom/xmldom'
import { ART_FORMAT_VERSION, artSchema, isValidPathData, pathBounds } from '../art'
import type { ArtItem, Bounds, ColoringArt, SvgConversion, SvgErrorCode, SvgLimits, SvgWarning, SvgWarningCode } from '../types'
import { parseColor, relativeLuminance, toHex, type Rgb } from './color'
import { applyTransforms, isClosedPath, roundPath, transformScale } from './geometry'
import {
  BACKGROUND_TOLERANCE,
  DEFAULT_SVG_LIMITS,
  INK_LUMINANCE_MAX,
  MAX_USE_DEPTH,
  PATH_PRECISION,
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
  transforms: readonly string[]
  style: StyleDeclarations
  useDepth: number
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
  private regionCount = 0
  private hasBackground = false
  private deadline = 0

  constructor(private readonly limits: SvgLimits) {}

  convert(source: string): { art: ColoringArt, warnings: SvgWarning[] } {
    this.deadline = Date.now() + this.limits.timeBudgetMs

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
    this.viewBox = readViewBox(root)

    for (const child of childElements(root)) {
      this.visit(child, { transforms: [], style: resolveStyle(root, INITIAL_STYLE, this.classRules), useDepth: 0 })
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
      })
    }

    let nextId = 1
    for (const item of this.items) {
      if (item.type === 'region') item.id = nextId++
    }

    const art = artSchema.parse({ version: ART_FORMAT_VERSION, viewBox: this.viewBox, items: this.items })
    return { art, warnings: [...this.warnings.values()] }
  }

  private parse(source: string): Element {
    let document
    try {
      document = new DOMParser({
        onError: (level, message) => {
          if (level !== 'warning') throw new SvgConversionError('malformed', message)
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
    for (let i = 0; i < all.length; i++) {
      const element = all.item(i)!
      const id = element.getAttribute('id')
      if (id && !this.ids.has(id)) this.ids.set(id, element)
      if (element.localName === 'style') css.push(element.textContent ?? '')
    }
    this.classRules = parseClassRules(css.join('\n'))
  }

  private warn(code: SvgWarningCode, detail?: string) {
    this.warnings.set(`${code}:${detail ?? ''}`, detail ? { code, detail } : { code })
  }

  private visit(element: Element, parent: Context) {
    if (Date.now() > this.deadline) throw new SvgConversionError('timeout')

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

    const ownTransform = element.getAttribute('transform')?.trim()
    const context: Context = {
      transforms: ownTransform ? [...parent.transforms, ownTransform] : parent.transforms,
      style,
      useDepth: parent.useDepth,
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
      this.warn('external-reference', href.slice(0, 64))
      return
    }
    const target = this.ids.get(href.slice(1))
    if (!target || context.useDepth >= MAX_USE_DEPTH) return

    const x = numberAttr(element, 'x')
    const y = numberAttr(element, 'y')
    const referenced: Context = {
      ...context,
      transforms: x || y ? [...context.transforms, `translate(${x} ${y})`] : context.transforms,
      useDepth: context.useDepth + 1,
    }
    if (target.localName === 'symbol') this.visitChildren(target, referenced)
    else this.visit(target, referenced)
  }

  private emitShape(element: Element, tag: string, { transforms, style }: Context) {
    if (style.visibility === 'hidden' || style.visibility === 'collapse') return

    const raw = shapeToPath(element)
    if (!raw) return
    if (!isValidPathData(raw)) {
      this.warn('invalid-path', tag)
      return
    }

    const d = roundPath(applyTransforms(raw, transforms), PATH_PRECISION)
    if (d.length > this.limits.maxPathLength) {
      this.warn('path-too-long', tag)
      return
    }

    const closed = isClosedPath(d)
    const fillRule = style['fill-rule'] === 'evenodd' ? 'evenodd' : 'nonzero'
    // Lines have no interior, whatever their fill says.
    const fill = tag === 'line' ? { kind: 'none' as const } : this.paint(style.fill, style.color, style['fill-opacity'])
    const stroke = this.paint(style.stroke, style.color, style['stroke-opacity'])
    const strokeWidth = (Number.parseFloat(style['stroke-width'] ?? '1') || 0) * transformScale(transforms)
    const hasStroke = stroke.kind !== 'none' && strokeWidth > 0

    if (hasStroke && style['stroke-dasharray'] && style['stroke-dasharray'] !== 'none') {
      this.warn('ignored-dash')
    }

    const coversCanvas = fill.kind !== 'none' && this.isBackground(pathBounds(d))
    const isInkFill = fill.kind === 'color' && relativeLuminance(fill.rgb) <= INK_LUMINANCE_MAX && !coversCanvas
    const isRegion = !isInkFill && (fill.kind !== 'none' || (hasStroke && (closed || ALWAYS_CLOSED.has(tag))))

    if (isRegion) {
      if (fill.kind === 'unsupported') this.warn('unsupported-paint', fill.value.slice(0, 64))
      this.addRegion(d, fillRule, coversCanvas)
    }

    if (isInkFill || hasStroke) {
      this.items.push({
        type: 'ink',
        d,
        fillRule,
        fill: isInkFill && fill.kind === 'color' ? toHex(fill.rgb) : null,
        stroke: hasStroke ? this.inkColor(stroke) : null,
        strokeWidth: hasStroke ? Math.round(strokeWidth * 100) / 100 : 0,
        lineCap: oneOf(style['stroke-linecap'], ['butt', 'round', 'square'] as const, 'butt'),
        lineJoin: oneOf(style['stroke-linejoin'], ['miter', 'round', 'bevel'] as const, 'miter'),
        miterLimit: Math.max(1, Number.parseFloat(style['stroke-miterlimit'] ?? '4') || 4),
      })
    }
  }

  private addRegion(d: string, fillRule: 'nonzero' | 'evenodd', coversCanvas: boolean) {
    // Only the first full-canvas shape (a Figma frame fill, typically) is the
    // background; later ones are ordinary areas.
    const kind = coversCanvas && !this.hasBackground && this.regionCount === 0 ? 'background' : 'area'
    if (kind === 'background') {
      this.hasBackground = true
    }
    else if (++this.regionCount > this.limits.maxRegions) {
      throw new SvgConversionError('too-many-regions')
    }
    this.items.push({ type: 'region', id: 0, kind, d, fillRule })
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
    if (stroke.kind === 'unsupported') this.warn('unsupported-paint', stroke.value.slice(0, 64))
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
    return parts as [number, number, number, number]
  }
  const width = numberAttr(root, 'width')
  const height = numberAttr(root, 'height')
  if (width > 0 && height > 0) return [0, 0, width, height]
  throw new SvgConversionError('no-dimensions')
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback
}

const BYTE_ORDER_MARK = 0xFE_FF

function stripBom(source: string): string {
  return source.charCodeAt(0) === BYTE_ORDER_MARK ? source.slice(1) : source
}
