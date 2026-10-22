import { eq } from 'drizzle-orm'
import type { Database } from '../../../core/server/utils/db'
import { DEFAULT_PAINTED_TOLERANCE, MAX_PAINTED_TOLERANCE, MIN_PAINTED_TOLERANCE, paletteSchema, SETTING_PAINTED_TOLERANCE, SETTING_PALETTE } from '../../shared/admin'
import { clonePalette } from '../../shared/palette'
import type { PaletteColor } from '../../shared'
import { appSettings } from '../db/schema'

async function readSetting(db: Database, key: string): Promise<unknown> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, key)).limit(1)

  return row?.value
}

async function writeSetting(db: Database, key: string, value: unknown): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } })
}

/**
 * Share of a region that counts as coloured, as the administrator set it. A missing or unusable
 * value (not a number, outside the allowed range) is the default: a bad row must not break the editor.
 */
export async function getPaintedTolerance(db: Database): Promise<number> {
  const value = await readSetting(db, SETTING_PAINTED_TOLERANCE)

  return typeof value === 'number' && value >= MIN_PAINTED_TOLERANCE && value <= MAX_PAINTED_TOLERANCE ? value : DEFAULT_PAINTED_TOLERANCE
}

export async function setPaintedTolerance(db: Database, value: number): Promise<void> {
  await writeSetting(db, SETTING_PAINTED_TOLERANCE, value)
}

/**
 * The colours of the panel as the administrator set them. A missing row, or one that does not pass
 * the palette schema, gives the standard set: a bad row must not leave players without colours.
 */
export async function getPalette(db: Database): Promise<PaletteColor[]> {
  const parsed = paletteSchema.safeParse(await readSetting(db, SETTING_PALETTE))

  return parsed.success ? parsed.data : clonePalette()
}

export async function setPalette(db: Database, palette: PaletteColor[]): Promise<void> {
  await writeSetting(db, SETTING_PALETTE, palette)
}
