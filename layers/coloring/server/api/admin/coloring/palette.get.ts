import { getPalette } from '../../../services/settings'

/** The colours of the panel as players get them now. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  return getPalette(useDb())
})
