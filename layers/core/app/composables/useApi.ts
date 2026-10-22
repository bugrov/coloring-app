/** How long a request may take before it fails; a dead connection must not leave a button spinning forever. */
export const API_TIMEOUT_MS = 30_000

/**
 * The request function for user actions: `useRequestFetch` (it forwards the cookie during SSR)
 * with a time limit. `useFetch` calls pass `timeout: API_TIMEOUT_MS` themselves.
 */
export function useApi() {
  const request = useRequestFetch()

  // The cast keeps the typing of `$fetch` (its overloads); `.raw` and `.create` are not offered here.
  // `timeout` makes ofetch replace a `signal` of the caller: calls that bring their own signal use `useRequestFetch`.
  return ((url: string, options?: Parameters<typeof request>[1]) => request(url, { timeout: API_TIMEOUT_MS, ...options })) as typeof request
}
