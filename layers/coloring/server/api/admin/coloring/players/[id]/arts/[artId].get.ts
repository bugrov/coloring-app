import { playerHistoryQuerySchema } from '../../../../../../../shared/admin'
import { loadPlayerArtState } from '../../../../../../services/admin-players'

/**
 * The art and the whole history of one attempt of a player (the latest unless `attempt` is given),
 * for the administrator to replay. Read only.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { attempt } = parseQuery(event, playerHistoryQuerySchema)
  const state = await loadPlayerArtState(useDb(), parseUuidParam(event, 'id'), parseUuidParam(event, 'artId'), attempt)

  if (!state) throw apiError(404, 'not_found')
  setHeader(event, 'Cache-Control', 'no-store')

  return state
})
