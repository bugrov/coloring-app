import { artIsVisible } from '../../../../services/arts'
import { readThumbnail } from '../../../../services/thumbnails'

/**
 * The painted thumbnail of the latest attempt of the player. The gallery asks with
 * `?v=<stored at>`, so a new picture is a new URL and the browser may keep each one for good.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const artId = parseUuidParam(event, 'id')
  const db = useDb()
  if (!await artIsVisible(db, user.id, artId)) throw apiError(404, 'not_found')

  const thumbnail = await readThumbnail(db, useThumbnailStore(), user.id, artId)
  if (!thumbnail) throw apiError(404, 'not_found')
  setHeader(event, 'Content-Type', thumbnail.contentType)
  setHeader(event, 'Cache-Control', 'private, max-age=31536000, immutable')
  setHeader(event, 'Vary', 'Cookie')
  return thumbnail.stream
})
