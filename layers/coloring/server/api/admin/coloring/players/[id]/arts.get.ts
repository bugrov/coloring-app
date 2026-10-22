import { ADMIN_ERROR_MESSAGES } from '../../../../../../shared/admin'
import { getPlayer, listPlayerArts } from '../../../../../services/admin-players'

/** The player and every art they started, with all attempts. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()
  const player = await getPlayer(db, parseUuidParam(event, 'id'))
  if (!player) throw domainError(404, 'player_not_found', ADMIN_ERROR_MESSAGES.player_not_found)
  return { player, arts: await listPlayerArts(db, player.id) }
})
