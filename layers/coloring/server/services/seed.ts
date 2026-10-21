import { SVG_ERROR_MESSAGES, convertSvg } from '../../shared'
import type { Database } from '../../../core/server/utils/db'
import { arts } from '../db/schema'

export interface BuiltinArtSource {
  key: string
  title: string
  svg: string
}

/**
 * Puts the built-in arts into the database, idempotently: a new key is inserted, an existing one
 * gets its title and art refreshed (so a corrected drawing reaches production with the next deploy)
 * while keeping its `seq`, hence its place in the gallery. Sources go in from the last card to the
 * first: the gallery lists the highest `seq` first.
 */
export async function seedBuiltinArts(db: Database, sources: BuiltinArtSource[]): Promise<void> {
  for (const { key, title, svg } of [...sources].reverse()) {
    const converted = convertSvg(svg)
    if (!converted.ok) throw new Error(`Built-in art "${key}" does not convert: ${SVG_ERROR_MESSAGES[converted.error]}`)

    await db
      .insert(arts)
      .values({ source: 'builtin', builtinKey: key, title, data: converted.art })
      .onConflictDoUpdate({ target: arts.builtinKey, set: { title, data: converted.art } })
  }
}
