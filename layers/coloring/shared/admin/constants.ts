/** What players see of a built-in or admin art: `draft` and `hidden` are visible to the administrator only. */
export const ART_STATUSES = ['draft', 'published', 'hidden'] as const

/** Share of a region that must be coloured for it to count as done, until the administrator changes it. */
export const DEFAULT_PAINTED_TOLERANCE = 0.95
/** What the administrator may set: below half a region "done" would mean nothing, above 1 it is unreachable. */
export const MIN_PAINTED_TOLERANCE = 0.5
export const MAX_PAINTED_TOLERANCE = 1

/** Days the statistics cover when nothing else is asked, and at most. */
export const DEFAULT_STATS_DAYS = 30
export const MAX_STATS_DAYS = 180

/** Players found by one search. */
export const PLAYER_SEARCH_LIMIT = 20

/** Countries and players one art may be assigned to. */
export const MAX_ASSIGNMENTS = 100

/** The key of the tolerance in `app_settings`. */
export const SETTING_PAINTED_TOLERANCE = 'paintedTolerance'
