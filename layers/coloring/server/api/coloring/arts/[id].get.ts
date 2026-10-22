import { findVisibleArt } from '../../../services/arts'
import { getPaintedTolerance } from '../../../services/settings'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const art = await findVisibleArt(useDb(), user.id, parseUuidParam(event, 'id'))
  if (!art) throw apiError(404, 'not_found')

  // An import can be deleted and another player can sign in on the same browser: never reuse a
  // stored copy without asking the server.
  setHeader(event, 'Cache-Control', 'private, no-cache')
  setHeader(event, 'Vary', 'Cookie')
  return { id: art.id, title: art.title, art: art.data, tolerance: await getPaintedTolerance(useDb()) }
})
