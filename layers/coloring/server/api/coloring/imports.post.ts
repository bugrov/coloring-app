import { SVG_ERROR_MESSAGES, convertSvg } from '../../../shared'
import { DEFAULT_SVG_LIMITS } from '../../../shared/svg'
import { GALLERY_ERROR_MESSAGES, importQuerySchema, titleFromFileName } from '../../../shared/gallery'
import { importArt, importLimitReached } from '../../services/arts'

/**
 * Imports an SVG: the raw file is the request body. The pipeline turns it into our own normalized
 * art; the source markup is never stored. Only the title (from the file name) travels in the query.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { name } = parseQuery(event, importQuerySchema)

  // Before the costly conversion: a player at the limit must not be able to burn CPU with files.
  const db = useDb()
  if (await importLimitReached(db, user.id)) throw domainError(409, 'import_limit_reached', GALLERY_ERROR_MESSAGES.import_limit_reached)

  const body = await readRawBody(event, false)
  if (!body || body.length === 0) throw apiError(400, 'validation')
  if (body.length > DEFAULT_SVG_LIMITS.maxBytes) throw domainError(413, 'svg_rejected', SVG_ERROR_MESSAGES['too-large'])

  let source: string
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(body)
  }
  catch {
    throw domainError(422, 'svg_not_utf8', GALLERY_ERROR_MESSAGES.svg_not_utf8)
  }

  const converted = convertSvg(source)
  if (!converted.ok) throw domainError(422, 'svg_rejected', SVG_ERROR_MESSAGES[converted.error])

  const result = await importArt(db, user.id, titleFromFileName(name), converted.art)
  if (!result.ok) throw domainError(409, 'import_limit_reached', GALLERY_ERROR_MESSAGES.import_limit_reached)
  return { id: result.id, warnings: converted.warnings.map(warning => warning.code) }
})
