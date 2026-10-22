import { playerSearchQuerySchema } from '../../../../shared/admin'
import { searchPlayers } from '../../../services/admin-players'

/** Players whose name starts with `query`. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { query } = parseQuery(event, playerSearchQuerySchema)
  return searchPlayers(useDb(), query)
})
