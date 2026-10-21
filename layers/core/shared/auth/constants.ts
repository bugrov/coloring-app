export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 20

/** Letters of any script, digits, `_` and `-`; starts with a letter or digit. */
export const USERNAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u

export const ADMIN_LOGIN_MAX_LENGTH = 64
export const ADMIN_PASSWORD_MAX_LENGTH = 256

/** The session cookie lives this long; children come back after weeks. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
