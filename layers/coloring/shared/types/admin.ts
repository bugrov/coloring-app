import type { z } from 'zod'
import type { adminArtSchema, adminPlayerSchema, adminStatsSchema, playerArtSchema, playerAttemptSchema } from '../admin/schema'

export type AdminArt = z.infer<typeof adminArtSchema>
export type AdminPlayer = z.infer<typeof adminPlayerSchema>
export type AdminStats = z.infer<typeof adminStatsSchema>
export type PlayerAttempt = z.infer<typeof playerAttemptSchema>
export type PlayerArt = z.infer<typeof playerArtSchema>
