import { SVG_ERROR_MESSAGES, convertSvg } from '../../../../shared'
import { adminUploadQuerySchema } from '../../../../shared/admin'
import { GALLERY_ERROR_MESSAGES, titleFromFileName } from '../../../../shared/gallery'
import { DEFAULT_SVG_LIMITS } from '../../../../shared/svg'
import { createAdminArt } from '../../../services/admin-arts'

/**
 * Uploads an SVG as a new art: the raw file is the body, the server converts it (the same pipeline as a
 * player import, the source markup is never stored) and keeps it as a draft until it is published.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { name } = parseQuery(event, adminUploadQuerySchema)

  const body = await readRawBody(event, false)

  if (!body || body.length === 0) throw apiError(400, 'validation')
  if (body.length > DEFAULT_SVG_LIMITS.maxBytes) throw domainError(413, 'svg_rejected', SVG_ERROR_MESSAGES['too-large'])

  let source: string

  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(body)
  } catch {
    throw domainError(422, 'svg_not_utf8', GALLERY_ERROR_MESSAGES.svg_not_utf8)
  }

  const converted = convertSvg(source)

  if (!converted.ok) throw domainError(422, 'svg_rejected', SVG_ERROR_MESSAGES[converted.error])

  const id = await createAdminArt(useDb(), titleFromFileName(name), converted.art)

  return { id, warnings: converted.warnings.map(warning => warning.code) }
})
