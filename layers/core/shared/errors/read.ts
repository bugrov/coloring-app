import type { ApiErrorData } from '../types/api'
import { API_ERROR_MESSAGES } from './messages'

const FALLBACK: ApiErrorData = { code: 'internal', message: API_ERROR_MESSAGES.internal }
const RATE_LIMITED: ApiErrorData = { code: 'rate_limited', message: API_ERROR_MESSAGES.rate_limited }

const TOO_MANY_REQUESTS = 429

function isApiErrorData(value: unknown): value is ApiErrorData {
  return typeof value === 'object' && value !== null && 'code' in value && 'message' in value
    && typeof (value as ApiErrorData).message === 'string'
}

/**
 * Extracts the API error from whatever `$fetch` threw. The rate limiter of
 * nuxt-security answers with its own 429 that has no body of ours, so that
 * status is mapped here. Network failures and anything unexpected become the
 * generic message, never a raw error text.
 */
export function readApiError(error: unknown): ApiErrorData {
  const data = (error as { data?: { data?: unknown } } | null)?.data?.data
  if (isApiErrorData(data)) return data
  const status = (error as { statusCode?: number } | null)?.statusCode
  return status === TOO_MANY_REQUESTS ? RATE_LIMITED : FALLBACK
}
