export type ApiErrorCode
  = | 'validation'
    | 'username_taken'
    | 'rate_limited'
    | 'unauthorized'
    | 'forbidden'
    | 'invalid_credentials'
    | 'admin_disabled'
    | 'internal'

/** Body of every failed API call: `error.data.data` on the client. */
export interface ApiErrorData {
  code: ApiErrorCode
  /** Ready for the user, in Russian. */
  message: string
  /** Per-field messages for form validation errors. */
  fields?: Record<string, string>
}
