import { findVisibleArt } from '../../../../services/arts'
import { loadHistory } from '../../../../services/history'

/** The player's latest attempt at the art with all its steps; attempt 0 and no steps before the first one. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const artId = parseUuidParam(event, 'id')
  const db = useDb()
  if (!await findVisibleArt(db, user.id, artId)) throw apiError(404, 'not_found')

  // Another tab or device may have saved a moment ago: never serve a stored copy.
  setHeader(event, 'Cache-Control', 'no-store')
  return loadHistory(db, user.id, artId)
})
