import type { ApiErrorData } from '../types/api'
import { API_ERROR_MESSAGES } from './messages'

const FALLBACK: ApiErrorData = { code: 'internal', message: API_ERROR_MESSAGES.internal }

function isApiErrorData(value: unknown): value is ApiErrorData {
  return typeof value === 'object' && value !== null && 'code' in value && 'message' in value
    && typeof (value as ApiErrorData).message === 'string'
}

/**
 * Extracts the API error from whatever `$fetch` threw. Network failures and
 * anything unexpected become the generic message, never a raw error text.
 */
export function readApiError(error: unknown): ApiErrorData {
  const data = (error as { data?: { data?: unknown } } | null)?.data?.data
  return isApiErrorData(data) ? data : FALLBACK
}
