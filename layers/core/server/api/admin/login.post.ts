import { ADMIN_SESSION_MAX_AGE_SECONDS, adminLoginSchema } from '../../../shared/auth'
import { adminCredentialsFrom, verifyAdminCredentials } from '../../services/admin'
import { apiError, parseBody } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const input = await parseBody(event, adminLoginSchema)
  // With the event, the config reflects the environment variables at runtime (Nuxt docs).
  const verdict = verifyAdminCredentials(input, adminCredentialsFrom(useRuntimeConfig(event)))

  if (verdict === 'disabled') {
    audit('admin_login_disabled', event)

    throw apiError(503, 'admin_disabled')
  }
  if (verdict === 'invalid') {
    audit('admin_login_failed', event)

    throw apiError(401, 'invalid_credentials')
  }

  // The third argument is the module's documented per-call session config: a shorter life than a player's.
  await replaceUserSession(event, {
    user: { id: 'admin', username: input.login, role: 'admin' },
    secure: { role: 'admin' },
  }, { maxAge: ADMIN_SESSION_MAX_AGE_SECONDS })
  audit('admin_login_succeeded', event)

  return { ok: true }
})
