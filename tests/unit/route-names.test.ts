import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Source files of the app part of every layer (pages, components, composables, middleware, config). */
function appSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return appSources(path)
    return /\.(vue|ts)$/.test(entry.name) ? [path] : []
  })
}

const FILES = readdirSync('layers').flatMap(layer => appSources(join('layers', layer, 'app')))

// A route is reached by name ({ name: CoreRoutes.LOGIN }); a string path would break silently when a page moves.
const STRING_PATH_PATTERNS: [string, RegExp][] = [
  ['navigateTo with a string', /navigateTo\(\s*['"`]/],
  ['NuxtLink to="/..."', /\sto="\//],
  [':to with a string', /:to="\s*['"`]/],
  ['router.push/replace with a string', /router\.(push|replace)\(\s*['"`]/],
  ['entry with a path', /entry:\s*['"`]\//],
]

describe('route names', () => {
  it('finds the app sources it checks', () => {
    expect(FILES.length).toBeGreaterThan(10)
  })

  it.each(STRING_PATH_PATTERNS)('no source uses %s', (_label, pattern) => {
    const offenders = FILES.filter(file => pattern.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
