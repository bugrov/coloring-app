import { THUMBNAIL_MAX_BYTES } from '../../../../../shared/gallery'
import { artIsVisible } from '../../../../services/arts'
import { saveThumbnail } from '../../../../services/thumbnails'

/**
 * Stores the thumbnail of the latest attempt of the player: a small WebP or PNG of the painted
 * picture, made by the editor. The gallery card shows it instead of the empty art.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const artId = parseUuidParam(event, 'id')
  const db = useDb()
  if (!await artIsVisible(db, user.id, artId)) throw apiError(404, 'not_found')

  const body = await readRawBody(event, false)
  if (!body || body.length === 0) throw apiError(400, 'validation')
  if (body.length > THUMBNAIL_MAX_BYTES) throw domainError(413, 'thumbnail_too_large', 'Картинка слишком большая.')

  const result = await saveThumbnail(db, useThumbnailStore(), user.id, artId, body)
  if (!result.ok) throw result.reason === 'not_started' ? apiError(404, 'not_found') : apiError(422, 'validation')
  setResponseStatus(event, 204)
  return null
})
