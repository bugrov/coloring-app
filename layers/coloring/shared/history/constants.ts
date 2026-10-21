/** How many steps back the player can undo from the end of the history. */
export const UNDO_LIMIT = 100

/** A canvas checkpoint is kept every this many steps, so an undo replays fewer steps than this. */
export const CHECKPOINT_EVERY = 25

/** One step is one user action; a long stroke is split into several ops (see MAX_STROKE_POINTS). */
export const MAX_OPS_PER_STEP = 64

/** Steps in one save request. A longer backlog (offline work) goes out in several. */
export const MAX_BATCH_STEPS = 100

/** Size of one save request, below the body limit of the server (nuxt-security: 2 MB). */
export const MAX_BATCH_BYTES = 900_000

/** Steps one attempt may hold; the server refuses more, the editor tells the player. */
export const MAX_HISTORY_STEPS = 3000
