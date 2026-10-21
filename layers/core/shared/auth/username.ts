/** Display form: trimmed and composed (NFKC). */
export function normalizeUsername(value: string): string {
  return value.normalize('NFKC').trim()
}

/**
 * Uniqueness key: case-insensitive, and "ё" is "е" (`Ёлка` and `Елка` are one
 * name, as they are for the people who type them). Two names with the same key
 * are the same name; the display name keeps what was typed.
 */
export function usernameKey(value: string): string {
  return normalizeUsername(value).toLowerCase().replaceAll('ё', 'е')
}
