import { adminArtPatchSchema } from '../../../../../shared/admin'
import { updateAdminArt } from '../../../../services/admin-arts'

/** Renames an art and/or publishes or hides it. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const artId = parseUuidParam(event, 'id')
  const patch = await parseBody(event, adminArtPatchSchema)
  if (!await updateAdminArt(useDb(), artId, patch)) throw apiError(404, 'not_found')
  return { ok: true }
})
