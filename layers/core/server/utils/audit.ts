import type { H3Event } from 'h3'

export type AuditEvent = 'admin_login_succeeded' | 'admin_login_failed' | 'admin_login_disabled'

/** One line of JSON per event; never anything the visitor typed (logins, passwords, names). */
export function formatAuditLine(event: AuditEvent, ip: string | undefined, at = new Date()): string {
  return JSON.stringify({ audit: event, ip: ip ?? 'unknown', at: at.toISOString() })
}

/**
 * Records a security-relevant event. Vercel keeps what the function prints to stdout.
 *
 * This is the only place that logs: nuxt-security strips console output from
 * production builds by default, and `removeLoggers` is switched off so that these
 * lines survive; the ESLint rule `no-console` keeps every other file from using it.
 */
export function audit(event: AuditEvent, h3Event: H3Event) {
  // eslint-disable-next-line no-console -- the audit trail, see above
  console.info(formatAuditLine(event, getRequestIP(h3Event, { xForwardedFor: true })))
}
