import { HISTORY_ERROR_MESSAGES, saveHistorySchema } from '../../../../../shared'
import { findVisibleArt } from '../../../../services/arts'
import { recordEvent } from '../../../../services/events'
import { saveHistory } from '../../../../services/history'

/**
 * Saves a batch of steps (see `saveHistorySchema`). Answers 409 when the revision, the attempt or
 * the number of steps on the server does not match what the client built on; the client then reads
 * the history again and puts its own steps on top.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const artId = parseUuidParam(event, 'id')
  const save = await parseBody(event, saveHistorySchema)
  const db = useDb()
  const art = await findVisibleArt(db, user.id, artId)
  if (!art) throw apiError(404, 'not_found')

  // Replay skips a step on a region that does not exist; storing one would only be garbage.
  const regions = new Set(art.data.items.flatMap(item => (item.type === 'region' ? [item.id] : [])))
  if (save.steps.some(step => step.some(op => !regions.has(op.region)))) throw domainError(422, 'history_region', HISTORY_ERROR_MESSAGES.history_region)

  const result = await saveHistory(db, user.id, artId, save)
  if (!result.ok) throw domainError(409, 'history_conflict', HISTORY_ERROR_MESSAGES.history_conflict)

  // The first accepted save of an attempt with steps is its start; 100 % is its completion. Both count once.
  const base = { userId: user.id, artId, attempt: result.attempt, country: user.country ?? '' }
  if (result.rev === 1 && save.steps.length > 0) await recordEvent(db, { ...base, type: 'start' })
  if (save.percent === 100) await recordEvent(db, { ...base, type: 'complete' })
  return { attempt: result.attempt, rev: result.rev }
})
