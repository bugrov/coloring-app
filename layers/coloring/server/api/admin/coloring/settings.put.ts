import { settingsSchema } from '../../../../shared/admin'
import { setPaintedTolerance } from '../../../services/settings'

/** Sets the share of a region that counts as coloured; players get it with the next art they open. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { paintedTolerance } = await parseBody(event, settingsSchema)

  await setPaintedTolerance(useDb(), paintedTolerance)

  return { paintedTolerance }
})
