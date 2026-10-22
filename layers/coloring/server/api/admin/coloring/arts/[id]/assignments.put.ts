import { assignmentsSchema } from '../../../../../../shared/admin'
import { setAssignments } from '../../../../../services/admin-arts'

/** Sets who may see the art: the listed countries and players, or everyone when both lists are empty. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const artId = parseUuidParam(event, 'id')
  const assignment = await parseBody(event, assignmentsSchema)
  if (!await setAssignments(useDb(), artId, assignment)) throw apiError(404, 'not_found')
  return { ok: true }
})
