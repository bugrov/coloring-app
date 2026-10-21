import { z } from 'zod'
import { MAX_BATCH_STEPS, MAX_HISTORY_STEPS, MAX_OPS_PER_STEP } from './constants'
import { opSchema } from '../ops/schema'

/** One user action: its ops are applied and taken back together. */
export const stepSchema = z.array(opSchema).min(1).max(MAX_OPS_PER_STEP)

const count = z.number().int().min(0).max(MAX_HISTORY_STEPS)

/** What the editor stores for an attempt: every step and where the player stands among them. */
export const historyStateSchema = z.object({
  /** 0 while the player has not started the art. */
  attempt: z.number().int().min(0),
  /** Counts accepted saves; a save made against an older one is a conflict. */
  rev: z.number().int().min(0),
  /** Steps applied now; the ones after it are the redo branch. */
  cursor: count,
  steps: z.array(stepSchema).max(MAX_HISTORY_STEPS),
})

/**
 * A save: "keep the first `keep` steps you have, replace the rest with `steps`, set the cursor".
 * `rev` is the version the client built it on. Resending a save is harmless: it is refused as a
 * conflict, and the client sees its steps are already there.
 */
export const saveHistorySchema = z.object({
  attempt: z.number().int().min(0),
  rev: z.number().int().min(0),
  keep: count,
  steps: z.array(stepSchema).max(MAX_BATCH_STEPS),
  cursor: count,
  /** Progress of the picture as the editor measured it; shown in the gallery. */
  percent: z.number().int().min(0).max(100),
}).refine(save => save.cursor <= save.keep + save.steps.length, 'The cursor is past the last step')
  .refine(save => save.keep + save.steps.length <= MAX_HISTORY_STEPS, 'Too many steps')

export const saveHistoryResultSchema = z.object({
  attempt: z.number().int().min(1),
  rev: z.number().int().min(1),
})
