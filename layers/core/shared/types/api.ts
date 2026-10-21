export type ApiErrorCode
  = | 'validation'
    | 'rate_limited'
    | 'unauthorized'
    | 'forbidden'
    | 'not_found'
    | 'invalid_credentials'
    | 'admin_disabled'
    | 'internal'

/** Body of every failed API call: `error.data.data` on the client. */
export interface ApiErrorData {
  /** One of `ApiErrorCode`, or a code a game defines for its own errors. */
  code: string
  /** Ready for the user, in Russian. */
  message: string
  /** Per-field messages for form validation errors. */
  fields?: Record<string, string>
}
