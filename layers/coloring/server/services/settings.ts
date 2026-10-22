import { eq } from 'drizzle-orm'
import type { Database } from '../../../core/server/utils/db'
import { DEFAULT_PAINTED_TOLERANCE, MAX_PAINTED_TOLERANCE, MIN_PAINTED_TOLERANCE, paletteSchema, SETTING_PAINTED_TOLERANCE, SETTING_PALETTE } from '../../shared/admin'
import { PALETTE } from '../../shared/palette'
import type { PaletteColor } from '../../shared'
import { appSettings } from '../db/schema'

/**
 * Share of a region that counts as coloured, as the administrator set it. A missing or unusable
 * value (not a number, outside the allowed range) is the default: a bad row must not break the editor.
 */
export async function getPaintedTolerance(db: Database): Promise<number> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, SETTING_PAINTED_TOLERANCE)).limit(1)
  const value = row?.value

  return typeof value === 'number' && value >= MIN_PAINTED_TOLERANCE && value <= MAX_PAINTED_TOLERANCE ? value : DEFAULT_PAINTED_TOLERANCE
}

export async function setPaintedTolerance(db: Database, value: number): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: SETTING_PAINTED_TOLERANCE, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } })
}

/**
 * The colours of the panel as the administrator set them. A missing row, or one that does not pass
 * the palette schema, gives the standard set: a bad row must not leave players without colours.
 */
export async function getPalette(db: Database): Promise<PaletteColor[]> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, SETTING_PALETTE)).limit(1)
  const parsed = paletteSchema.safeParse(row?.value)

  return parsed.success ? parsed.data : PALETTE.map(color => ({ ...color }))
}

export async function setPalette(db: Database, palette: PaletteColor[]): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: SETTING_PALETTE, value: palette })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: palette, updatedAt: new Date() } })
}
