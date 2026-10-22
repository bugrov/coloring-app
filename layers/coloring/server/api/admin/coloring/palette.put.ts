import { settingsPaletteBodySchema } from '../../../../shared/admin'
import { setPalette } from '../../../services/settings'

/** Sets the colours of the panel; players get them with the next art they open. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { palette } = await parseBody(event, settingsPaletteBodySchema)

  await setPalette(useDb(), palette)

  return palette
})
