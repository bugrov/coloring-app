import { z } from 'zod'
import { COUNTRY_CODES } from '../../../core/shared/countries'
import { ART_TITLE_MAX_LENGTH } from '../gallery/constants'
import {
  ART_STATUSES,
  DEFAULT_STATS_DAYS,
  MAX_ASSIGNMENTS,
  MAX_PAINTED_TOLERANCE,
  MAX_STATS_DAYS,
  MIN_PAINTED_TOLERANCE,
  PALETTE_NAME_MAX_LENGTH,
  PALETTE_SIZE,
} from './constants'

const country = z.enum(COUNTRY_CODES as unknown as [string, ...string[]])

export const artStatusSchema = z.enum(ART_STATUSES)

/** Name of an uploaded file, reduced to a title by the server. */
export const adminUploadQuerySchema = z.object({
  name: z.string().trim().max(200).optional(),
})

export const adminArtPatchSchema = z.object({
  title: z.string().trim().min(1, 'Введите название').max(ART_TITLE_MAX_LENGTH).optional(),
  status: artStatusSchema.optional(),
}).refine(patch => patch.title !== undefined || patch.status !== undefined, 'Nothing to change')

/** Who may see the art: empty on both means everyone. */
export const assignmentsSchema = z.object({
  countries: z.array(country).max(MAX_ASSIGNMENTS),
  players: z.array(z.uuid()).max(MAX_ASSIGNMENTS),
})

export const settingsSchema = z.object({
  paintedTolerance: z.number().min(MIN_PAINTED_TOLERANCE, 'Не меньше 50 %').max(MAX_PAINTED_TOLERANCE, 'Не больше 100 %'),
})

/** The colour panel: exactly PALETTE_SIZE colours, each `#rrggbb` in lowercase with a name, no colour twice. */
export const paletteSchema = z.array(z.object({
  hex: z.string().regex(/^#[0-9a-f]{6}$/, 'Цвет вида #rrggbb'),
  name: z.string().trim().min(1, 'Введите название').max(PALETTE_NAME_MAX_LENGTH),
})).length(PALETTE_SIZE).refine(colors => new Set(colors.map(color => color.hex)).size === colors.length, 'Цвета не должны повторяться')

export const settingsPaletteBodySchema = z.object({ palette: paletteSchema })

export const statsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(MAX_STATS_DAYS).default(DEFAULT_STATS_DAYS),
})

export const playerSearchQuerySchema = z.object({
  query: z.string().trim().min(1).max(50),
})

export const playerHistoryQuerySchema = z.object({
  attempt: z.coerce.number().int().min(1).optional(),
})

const count = z.number().int().min(0)

export const adminPlayerSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  country,
})

export const adminArtSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  source: z.enum(['builtin', 'admin']),
  status: artStatusSchema,
  opens: count,
  starts: count,
  completes: count,
  assignedCountries: z.array(country),
  assignedPlayers: z.array(adminPlayerSchema),
})

export const adminStatsSchema = z.object({
  totals: z.object({ opens: count, starts: count, completes: count, restarts: count, players: count }),
  arts: z.array(z.object({ id: z.uuid(), title: z.string(), opens: count, starts: count, completes: count, restarts: count })),
  /** One entry per day of the period, oldest first, days without events included. */
  daily: z.array(z.object({ day: z.string(), opens: count, starts: count, completes: count, restarts: count })),
  countries: z.array(z.object({ country, opens: count, players: count })),
})

export const playerAttemptSchema = z.object({
  attempt: z.number().int().min(1),
  percent: z.number().int().min(0).max(100),
  completed: z.boolean(),
  steps: count,
  updatedAt: z.string(),
})

export const playerArtSchema = z.object({
  artId: z.uuid(),
  title: z.string(),
  attempts: z.array(playerAttemptSchema),
})
