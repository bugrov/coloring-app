import { artToSvg } from '../../../../../shared/art'
import { findVisibleArt } from '../../../../services/arts'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const art = await findVisibleArt(useDb(), user.id, parseUuidParam(event, 'id'))

  if (!art) throw apiError(404, 'not_found')

  setHeader(event, 'Content-Type', 'image/svg+xml; charset=utf-8')
  // The same art for the same player never changes; private because the URL needs the session.
  setHeader(event, 'Cache-Control', 'private, max-age=3600')
  // Belt and braces for an SVG that is only ever shown through <img>: no scripts if opened directly.
  setHeader(event, 'Content-Security-Policy', 'default-src \'none\'; style-src \'unsafe-inline\'')

  return artToSvg(art.data)
})
