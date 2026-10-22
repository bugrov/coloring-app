import { z, type ZodError, type ZodType } from 'zod'
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

/** One message per field. An issue without a field is about the body as a whole: its text is the library's, not ours. */
function fieldMessages(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {}

  for (const issue of error.issues) {
    if (issue.path.length === 0) fields.form ??= API_ERROR_MESSAGES.validation
    else fields[String(issue.path[0])] ??= issue.message
  }

  return fields
}

/** Validates query-string parameters. A wrong one is a 422 with a message per field. */
export function parseQuery<T>(event: H3Event, schema: ZodType<T>): T {
  const result = schema.safeParse(getQuery(event))

  if (result.success) return result.data

  throw apiError(422, 'validation', { fields: fieldMessages(result.error) })
}

/** A route parameter that must be a UUID; anything else cannot name a row, so it is a 404. */
export function parseUuidParam(event: H3Event, name: string): string {
  const parsed = z.uuid().safeParse(getRouterParam(event, name))

  if (!parsed.success) throw apiError(404, 'not_found')

  return parsed.data
}

/**
 * Reads the JSON body and validates it. A body that cannot be read at all is a
 * 400; a body that is read but wrong becomes a 422 with a message per field.
 */
export async function parseBody<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  let body: unknown

  try {
    body = await readBody(event)
  } catch {
    throw apiError(400, 'validation')
  }

  const result = schema.safeParse(body)

  if (result.success) return result.data

  throw apiError(422, 'validation', { fields: fieldMessages(result.error) })
}
