import { getPaintedTolerance } from '../../../services/settings'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return { paintedTolerance: await getPaintedTolerance(useDb()) }
})
