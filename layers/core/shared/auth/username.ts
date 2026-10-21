/** Display form: trimmed and composed (NFKC). */
export function normalizeUsername(value: string): string {
  return value.normalize('NFKC').trim()
}

/** Uniqueness key: case-insensitive. Two names with the same key are the same name. */
export function usernameKey(value: string): string {
  return normalizeUsername(value).toLowerCase()
}
