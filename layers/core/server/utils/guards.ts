import type { H3Event } from 'h3'
import { apiError } from './errors'

/**
 * Every route that serves a user's data starts with this. The role comes from
 * `secure`, which only the server writes and reads.
 */
export async function requireUser(event: H3Event) {
  const session = await getUserSession(event)
  if (!session.user || session.secure?.role !== 'user') throw apiError(401, 'unauthorized')
  return session.user
}

/** Every route under `/api/admin` starts with this; hiding the page is not protection. */
export async function requireAdmin(event: H3Event) {
  const session = await getUserSession(event)
  if (!session.user) throw apiError(401, 'unauthorized')
  if (session.secure?.role !== 'admin') throw apiError(403, 'forbidden')
  return session.user
}
