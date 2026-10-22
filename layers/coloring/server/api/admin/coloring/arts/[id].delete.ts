import { deleteAdminArt } from '../../../../services/admin-arts'
import { thumbnailPathsOfArt } from '../../../../services/thumbnails'

/** Deletes an art the administrator uploaded, with its attempts, events and the players' thumbnails. Built-in arts are hidden instead. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()
  const artId = parseUuidParam(event, 'id')
  // The names are read first: the rows that hold them go with the art.
  const files = await thumbnailPathsOfArt(db, artId)

  if (!await deleteAdminArt(db, artId)) throw apiError(404, 'not_found')

  try {
    await useThumbnailStore().remove(files)
  } catch {
    // Wasted space only; the art is gone and the request did what it was asked to.
  }

  return { ok: true }
})
