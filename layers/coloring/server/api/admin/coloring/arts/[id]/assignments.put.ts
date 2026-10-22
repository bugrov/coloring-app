import { ADMIN_ERROR_MESSAGES, assignmentsSchema } from '../../../../../../shared/admin'
import { setAssignments } from '../../../../../services/admin-arts'

/** Sets who may see the art: the listed countries and players, or everyone when both lists are empty. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const artId = parseUuidParam(event, 'id')
  const assignment = await parseBody(event, assignmentsSchema)
  const result = await setAssignments(useDb(), artId, assignment)

  if (result === 'not_found') throw apiError(404, 'not_found')
  if (result === 'unknown_player') throw domainError(422, 'player_not_found', ADMIN_ERROR_MESSAGES.player_not_found)

  return { ok: true }
})
