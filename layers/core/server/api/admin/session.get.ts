import { requireAdmin } from '../../utils/guards'

// Smallest guarded admin route: the pattern every /api/admin handler starts with.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  return { ok: true }
})
