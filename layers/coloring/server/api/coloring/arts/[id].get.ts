import { findVisibleArt } from '../../../services/arts'
import { getPaintedTolerance, getPalette } from '../../../services/settings'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = useDb()
  // Independent reads, one round trip's time instead of three.
  const [art, tolerance, palette] = await Promise.all([findVisibleArt(db, user.id, parseUuidParam(event, 'id')), getPaintedTolerance(db), getPalette(db)])
  if (!art) throw apiError(404, 'not_found')

  // An import can be deleted and another player can sign in on the same browser: never reuse a
  // stored copy without asking the server.
  setHeader(event, 'Cache-Control', 'private, no-cache')
  setHeader(event, 'Vary', 'Cookie')
  return { id: art.id, title: art.title, art: art.data, tolerance, palette }
})
