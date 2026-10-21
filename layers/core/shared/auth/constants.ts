export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 20

/**
 * Letters of any script, combining marks (vowel signs in Devanagari, Thai and
 * others are marks), digits, `_` and `-`; starts with a letter or digit.
 */
export const USERNAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}_-]*$/u

/**
 * Code points that render as nothing (Hangul fillers, zero-width and joiner
 * characters, variation selectors, the combining grapheme joiner): they would
 * make two different names look the same, or a name look empty.
 */
export const INVISIBLE_CHARACTERS = /\p{Default_Ignorable_Code_Point}/u

/** Real scripts stack at most a few marks on a letter (Thai: vowel and tone mark); more is "zalgo" text. */
export const TOO_MANY_MARKS = /\p{M}{4,}/u

export const ADMIN_LOGIN_MAX_LENGTH = 64
export const ADMIN_PASSWORD_MAX_LENGTH = 256

/** The session cookie lives this long; children come back after weeks. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

/** An administrator signs in again every working day: a stolen cookie cannot be revoked. */
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8
