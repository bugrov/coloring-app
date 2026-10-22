import { deleteImport, findVisibleArt } from '../../../services/arts'
import { thumbnailPathsOfArt } from '../../../services/thumbnails'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const artId = parseUuidParam(event, 'id')
  const db = useDb()
  // Someone else's art, a built-in one and a missing one all look the same: not found.
  const art = await findVisibleArt(db, user.id, artId)

  if (art?.source !== 'user' || art.ownerId !== user.id) throw apiError(404, 'not_found')

  // The files go with the art; their names are read first, the rows that hold them are deleted with it.
  const files = await thumbnailPathsOfArt(db, artId)

  if (!await deleteImport(db, user.id, artId)) throw apiError(404, 'not_found')

  // The art is gone already; a file that cannot be removed now is only wasted space, not a failed request.
  try {
    await useThumbnailStore().remove(files)
  } catch {
    // Wasted space only; the player's request did what it was asked to.
  }

  return { ok: true }
})
