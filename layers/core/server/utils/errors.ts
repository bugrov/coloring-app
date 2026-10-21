import type { ZodType } from 'zod'
import type { H3Event } from 'h3'
import { API_ERROR_MESSAGES } from '../../shared/errors'
import type { ApiErrorCode, ApiErrorData } from '../../shared/types/api'

/**
 * Builds the single error shape the API speaks: a short code and a Russian
 * message for the user. Details of failures (SQL, stack traces, raw
 * validation text) are never put into it.
 */
export function apiError(statusCode: number, code: ApiErrorCode, extra: Pick<ApiErrorData, 'fields'> = {}) {
  const data: ApiErrorData = { code, message: API_ERROR_MESSAGES[code], ...extra }
  return createError({ statusCode, statusMessage: code, data })
}

/**
 * An error with a code and message a game defines (its own messages.ts), for failures that
 * are not part of the platform's codes.
 */
export function domainError(statusCode: number, code: string, message: string) {
  const data: ApiErrorData = { code, message }
  return createError({ statusCode, statusMessage: code, data })
}

/**
 * Reads the JSON body and validates it. A body that cannot be read at all is a
 * 400; a body that is read but wrong becomes a 422 with a message per field.
 */
export async function parseBody<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  let body: unknown
  try {
    body = await readBody(event)
  }
  catch {
    throw apiError(400, 'validation')
  }

  const result = schema.safeParse(body)
  if (result.success) return result.data

  const fields: Record<string, string> = {}
  for (const issue of result.error.issues) {
    // An issue without a field is about the body as a whole: its text is the library's, not ours.
    if (issue.path.length === 0) fields.form ??= API_ERROR_MESSAGES.validation
    else fields[String(issue.path[0])] ??= issue.message
  }
  throw apiError(422, 'validation', { fields })
}
