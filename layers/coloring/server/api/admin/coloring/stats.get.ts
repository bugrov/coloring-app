import { statsQuerySchema } from '../../../../shared/admin'
import { loadStats } from '../../../services/admin-stats'

/** Analytics of the last `days` days. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { days } = parseQuery(event, statsQuerySchema)
  return loadStats(useDb(), days)
})
