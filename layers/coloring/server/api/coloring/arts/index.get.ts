import { galleryQuerySchema } from '../../../../shared/gallery'
import { listGallery } from '../../../services/arts'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { cursor } = parseQuery(event, galleryQuerySchema)
  return listGallery(useDb(), user.id, cursor === undefined ? undefined : Number(cursor))
})
