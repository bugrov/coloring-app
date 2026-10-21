/** Saving waits this long after the last change, so a burst of strokes goes out as one request. */
export const SAVE_DELAY_MS = 2000
/** ...but never longer than this since the first unsaved change. */
export const SAVE_MAX_WAIT_MS = 10_000
/** A backlog of this many steps is saved at once. */
export const SAVE_AT_STEPS = 10

/** Pause before a failed save is tried again; it doubles up to the maximum. */
export const RETRY_BASE_MS = 1000
export const RETRY_MAX_MS = 30_000

/** Unsent work is written to the browser's storage after this pause, so a crash loses little. */
export const OUTBOX_DELAY_MS = 300

/** Conflicts in a row after which the editor stops trying: something is wrong, not just busy. */
export const MAX_CONFLICTS_IN_A_ROW = 5
