/** Display form: trimmed and composed (NFKC). */
export function normalizeUsername(value: string): string {
  return value.normalize('NFKC').trim()
}

/**
 * Uniqueness key: case-insensitive. Two names with the same key are the same name.
 *
 * Each character goes up and down again: lower-casing alone keeps a final
 * sigma (ς) and a sharp s (ß) apart from σ and ss, so `ΟΔΟΣ` and `οδοσ`
 * would be two names. Normalizing last keeps the key canonical.
 */
export function usernameKey(value: string): string {
  const folded = Array.from(normalizeUsername(value), character => character.toUpperCase().toLowerCase())
  return folded.join('').normalize('NFKC')
}
