import type { z } from 'zod'
import type { historyStateSchema, saveHistoryResultSchema, saveHistorySchema, stepSchema } from '../history/schema'

export type HistoryStep = z.infer<typeof stepSchema>
export type HistoryState = z.infer<typeof historyStateSchema>
export type SaveHistoryRequest = z.infer<typeof saveHistorySchema>
export type SaveHistoryResult = z.infer<typeof saveHistoryResultSchema>
