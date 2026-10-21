import { adminLoginSchema } from '../../../shared/auth'
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

  await replaceUserSession(event, {
    user: { id: 'admin', username: input.login, country: '', role: 'admin' },
    secure: { role: 'admin' },
  })
  return { ok: true }
})
