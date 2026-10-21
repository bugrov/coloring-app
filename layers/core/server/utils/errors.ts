import type { ZodType } from 'zod'
import type { H3Event } from 'h3'
import { API_ERROR_MESSAGES } from '../../shared/errors'
import type { ApiErrorCode, ApiErrorData } from '../../shared/types/api'

/**
 * Builds the single error shape the API speaks: a short code and a Russian
 * message for the user. Details of failures (SQL, stack traces, raw
 * validation text) are never put into it.
 */
export function apiError(statusCode: number, code: ApiErrorCode, extra: Pick<ApiErrorData, 'fields' | 'retryAfter'> = {}) {
  const data: ApiErrorData = { code, message: API_ERROR_MESSAGES[code], ...extra }
  return createError({ statusCode, statusMessage: code, data })
}

/** Reads the JSON body and validates it; failures become a 422 with a message per field. */
export async function parseBody<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  const result = schema.safeParse(await readBody(event))
  if (result.success) return result.data

  const fields: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? 'form')
    fields[field] ??= issue.message
  }
  throw apiError(422, 'validation', { fields })
}
