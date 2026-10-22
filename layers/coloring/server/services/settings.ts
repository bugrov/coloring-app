import { eq } from 'drizzle-orm'
import type { Database } from '../../../core/server/utils/db'
import { DEFAULT_PAINTED_TOLERANCE, MAX_PAINTED_TOLERANCE, MIN_PAINTED_TOLERANCE, SETTING_PAINTED_TOLERANCE } from '../../shared/admin'
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
