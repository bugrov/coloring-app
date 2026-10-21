import { createHash, timingSafeEqual } from 'node:crypto'

export interface AdminCredentials {
  login: string
  password: string
}

export type AdminVerdict = 'ok' | 'invalid' | 'disabled'

/** Equal-length digests make `timingSafeEqual` applicable and hide the length of the secret. */
function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

function sameString(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b))
}

/**
 * Checks the submitted credentials against the single admin from the
 * environment. Both fields are always compared, so the response time does not
 * tell which of them was wrong. Without configured credentials the admin
 * login is disabled, never open.
 */
export function verifyAdminCredentials(input: AdminCredentials, expected: Partial<AdminCredentials>): AdminVerdict {
  if (!expected.login || !expected.password) return 'disabled'
  const loginMatches = sameString(input.login, expected.login)
  const passwordMatches = sameString(input.password, expected.password)
  return loginMatches && passwordMatches ? 'ok' : 'invalid'
}
