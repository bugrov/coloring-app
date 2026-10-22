import { ADMIN_ERROR_MESSAGES, adminArtPatchSchema } from '../../../../../shared/admin'
import { updateAdminArt } from '../../../../services/admin-arts'

/** Renames an art and/or publishes or hides it. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const artId = parseUuidParam(event, 'id')
  const patch = await parseBody(event, adminArtPatchSchema)
  const result = await updateAdminArt(useDb(), artId, patch)

  if (result === 'not_found') throw apiError(404, 'not_found')
  if (result === 'title_locked') throw domainError(422, 'title_locked', ADMIN_ERROR_MESSAGES.title_locked)

  return { ok: true }
})
