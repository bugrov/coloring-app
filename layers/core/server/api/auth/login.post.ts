import { loginSchema } from '../../../shared/auth'
import { signIn } from '../../services/auth'
import { parseBody } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const input = await parseBody(event, loginSchema)
  const { user } = await signIn(useDb(), input)

  const { id, username, country } = user
  // replaceUserSession: signing in as a user must not keep any earlier (admin) session data.
  await replaceUserSession(event, {
    user: { id, username, country, role: 'user' },
    secure: { role: 'user' },
  })
  return { ok: true }
})
