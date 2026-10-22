import { getAdminArt } from '../../../../services/admin-arts'

/** One art with its drawing, for the preview before it is published. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const art = await getAdminArt(useDb(), parseUuidParam(event, 'id'))

  if (!art) throw apiError(404, 'not_found')

  return art
})
