export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 20

// Only the two alphabets of the audience, plus digits. Every other script brings invisible
// characters, stacked marks and case rules that make two names look alike; a child with another
// alphabet writes the name in Latin letters.
const LATIN = 'A-Za-z'
/** Cyrillic letters of Russian, Ukrainian, Belarusian, Kazakh and others, without the combining marks (U+0483–U+0489). */
const CYRILLIC = '\u0400-\u0481\u048A-\u052F'

/** Letters, digits, `_` and `-`; starts with a letter or digit. */
export const USERNAME_PATTERN = new RegExp(`^[${LATIN}${CYRILLIC}0-9][${LATIN}${CYRILLIC}0-9_-]*$`)

export const LATIN_LETTER = new RegExp(`[${LATIN}]`)
export const CYRILLIC_LETTER = new RegExp(`[${CYRILLIC}]`)

export const ADMIN_LOGIN_MAX_LENGTH = 64
export const ADMIN_PASSWORD_MAX_LENGTH = 256

/** The session cookie lives this long; children come back after weeks. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

/** An administrator signs in again every working day: a stolen cookie cannot be revoked. */
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8
