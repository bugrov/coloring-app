import { deleteAdminArt } from '../../../../services/admin-arts'

/** Deletes an art the administrator uploaded, with its attempts and events. Built-in arts are hidden instead. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  if (!await deleteAdminArt(useDb(), parseUuidParam(event, 'id'))) throw apiError(404, 'not_found')
  return { ok: true }
})
