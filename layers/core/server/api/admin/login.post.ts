import { ADMIN_SESSION_MAX_AGE_SECONDS, adminLoginSchema } from '../../../shared/auth'
import { verifyAdminCredentials } from '../../services/admin'
import { apiError, parseBody } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const input = await parseBody(event, adminLoginSchema)
  const verdict = verifyAdminCredentials(input, {
    login: process.env.ADMIN_LOGIN,
    password: process.env.ADMIN_PASSWORD,
  })
  if (verdict === 'disabled') throw apiError(503, 'admin_disabled')
  if (verdict === 'invalid') throw apiError(401, 'invalid_credentials')

  // The third argument is the module's documented per-call session config: a shorter life than a player's.
  await replaceUserSession(event, {
    user: { id: 'admin', username: input.login, role: 'admin' },
    secure: { role: 'admin' },
  }, { maxAge: ADMIN_SESSION_MAX_AGE_SECONDS })
  return { ok: true }
})
