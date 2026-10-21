import { deleteImport } from '../../../services/arts'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const artId = parseUuidParam(event, 'id')
  // Someone else's art, a built-in one and a missing one all look the same: not found.
  if (!await deleteImport(useDb(), user.id, artId)) throw apiError(404, 'not_found')
  return { ok: true }
})
