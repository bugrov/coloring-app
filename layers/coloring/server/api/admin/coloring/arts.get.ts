import { listAdminArts } from '../../../services/admin-arts'

/** Every built-in and admin art with its counters and assignments. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return listAdminArts(useDb())
})
