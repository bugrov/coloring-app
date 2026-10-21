import { loginSchema } from '../../../shared/auth'
import { signIn } from '../../services/auth'
import { apiError, parseBody } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const input = await parseBody(event, loginSchema)
  const result = await signIn(useDb(), input)
  if (!result.ok) throw apiError(409, 'username_taken')

  const { id, username, country } = result.user
  // replaceUserSession: signing in as a user must not keep any earlier (admin) session data.
  await replaceUserSession(event, {
    user: { id, username, country, role: 'user' },
    secure: { role: 'user' },
  })
  return { ok: true }
})
