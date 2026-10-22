/** How long a request may take before it fails; a dead connection must not leave a button spinning forever. */
export const API_TIMEOUT_MS = 30_000

/**
 * The request function for user actions: `useRequestFetch` (it forwards the cookie during SSR)
 * with a time limit. `useFetch` calls pass `timeout: API_TIMEOUT_MS` themselves.
 */
export function useApi() {
  const request = useRequestFetch()

  return ((url: string, options?: object) => request(url, { timeout: API_TIMEOUT_MS, ...options })) as typeof request
}
