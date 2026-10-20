import type { Element } from '@xmldom/xmldom'

/** Properties the pipeline understands; everything else is ignored. */
const STYLE_PROPERTIES = [
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-opacity',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'color',
  'opacity',
  'display',
  'visibility',
  'clip-path',
  'mask',
  'filter',
] as const

export type StyleProperty = typeof STYLE_PROPERTIES[number]
export type StyleDeclarations = Partial<Record<StyleProperty, string>>

/** Properties children take from their parent when they do not set them. */
const INHERITED: readonly StyleProperty[] = [
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-opacity',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'color',
  'visibility',
]

/** SVG initial values for inherited properties. */
export const INITIAL_STYLE: StyleDeclarations = {
  'fill': '#000000',
  'fill-opacity': '1',
  'fill-rule': 'nonzero',
  'stroke': 'none',
  'stroke-opacity': '1',
  'stroke-width': '1',
  'stroke-linecap': 'butt',
  'stroke-linejoin': 'miter',
  'stroke-miterlimit': '4',
  'color': '#000000',
  'visibility': 'visible',
}

const isStyleProperty = (name: string): name is StyleProperty =>
  (STYLE_PROPERTIES as readonly string[]).includes(name)

export function parseDeclarations(text: string): StyleDeclarations {
  const result: StyleDeclarations = {}
  for (const declaration of text.split(';')) {
    const colon = declaration.indexOf(':')
    if (colon === -1) continue
    const name = declaration.slice(0, colon).trim().toLowerCase()
    const value = declaration.slice(colon + 1).replace(/!important/i, '').trim()
    if (value && isStyleProperty(name)) result[name] = value
  }
  return result
}

/**
 * Class rules from `<style>` blocks (Illustrator and some Figma plugins export
 * them). Only plain `.class` selectors, possibly grouped, are supported.
 *
 * Scans with indexOf instead of regular expressions: the input is untrusted,
 * and regex matching over unbalanced braces or comments is quadratic.
 */
export function parseClassRules(css: string): Map<string, StyleDeclarations> {
  const rules = new Map<string, StyleDeclarations>()
  const text = stripComments(css)
  let position = 0
  while (position < text.length) {
    const open = text.indexOf('{', position)
    if (open === -1) break
    const close = text.indexOf('}', open + 1)
    if (close === -1) break

    // Blocks with nested braces (@media and the like) are not class rules.
    const body = text.slice(open + 1, close)
    if (!body.includes('{')) {
      const declarations = parseDeclarations(body)
      for (const selector of text.slice(position, open).split(',')) {
        const match = /^\s*\.([\w-]+)\s*$/.exec(selector)
        if (match) rules.set(match[1]!, { ...rules.get(match[1]!), ...declarations })
      }
    }
    position = close + 1
  }
  return rules
}

/** Removes `/* … *\/` comments in a single pass; an unterminated comment ends the text. */
function stripComments(css: string): string {
  let result = ''
  let position = 0
  while (position < css.length) {
    const start = css.indexOf('/*', position)
    if (start === -1) return result + css.slice(position)
    result += css.slice(position, start)
    const end = css.indexOf('*/', start + 2)
    if (end === -1) return result
    position = end + 2
  }
  return result
}

/**
 * Computes an element's style: inherited values, then presentation attributes,
 * then class rules, then the `style` attribute (increasing priority).
 */
export function resolveStyle(
  element: Element,
  parent: StyleDeclarations,
  classRules: Map<string, StyleDeclarations>,
): StyleDeclarations {
  const style: StyleDeclarations = {}
  for (const name of INHERITED) {
    if (parent[name] !== undefined) style[name] = parent[name]
  }

  for (const name of STYLE_PROPERTIES) {
    const value = element.getAttribute(name)?.trim()
    if (value) style[name] = value
  }

  for (const className of element.getAttribute('class')?.split(/\s+/) ?? []) {
    Object.assign(style, classRules.get(className))
  }

  Object.assign(style, parseDeclarations(element.getAttribute('style') ?? ''))

  for (const name of INHERITED) {
    if (style[name] === 'inherit') style[name] = parent[name]
  }
  return style
}
