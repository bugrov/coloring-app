import { findVisibleArt } from '../../../services/arts'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const art = await findVisibleArt(useDb(), user.id, parseUuidParam(event, 'id'))
  if (!art) throw apiError(404, 'not_found')

  // Private: the response depends on the session (an import is visible to its owner only).
  setHeader(event, 'Cache-Control', 'private, max-age=3600')
  return { id: art.id, title: art.title, art: art.data }
})
