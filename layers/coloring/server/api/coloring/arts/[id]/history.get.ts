import { historyReadQuerySchema } from '../../../../../shared/history'
import { artIsVisible } from '../../../../services/arts'
import { recordEvent } from '../../../../services/events'
import { loadHistory } from '../../../../services/history'

/** The player's latest attempt at the art with all its steps; attempt 0 and no steps before the first one. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const artId = parseUuidParam(event, 'id')
  const db = useDb()
  if (!await artIsVisible(db, user.id, artId)) throw apiError(404, 'not_found')

  // Another tab or device may have saved a moment ago: never serve a stored copy.
  setHeader(event, 'Cache-Control', 'no-store')
  const { track } = parseQuery(event, historyReadQuerySchema)
  const history = await loadHistory(db, user.id, artId)
  // Opening the editor is what "open" means. The editor says so with `track=open`; the read after
  // "start over" or any other reload of the same screen is not a new visit and counts nothing.
  // Written after the response: analytics must not make opening an art slower.
  if (track === 'open') event.waitUntil(recordEvent(db, { type: 'open', userId: user.id, artId, attempt: history.attempt, country: user.country ?? '' }))
  return history
})
