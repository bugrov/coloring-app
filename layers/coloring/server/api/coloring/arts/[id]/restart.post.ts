import { findVisibleArt } from '../../../../services/arts'
import { recordEvent } from '../../../../services/events'
import { restartArt } from '../../../../services/progress'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const artId = parseUuidParam(event, 'id')
  const db = useDb()

  if (!await findVisibleArt(db, user.id, artId)) throw apiError(404, 'not_found')

  const result = await restartArt(db, user.id, artId)

  if (result.ok && result.created) event.waitUntil(recordEvent(db, { type: 'restart', userId: user.id, artId, attempt: result.attempt, country: user.country ?? '' }))

  // Before the first attempt there is nothing to start over: the card already shows an empty art.
  return { attempt: result.ok ? result.attempt : 0 }
})
