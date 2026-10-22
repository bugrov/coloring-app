import { sql } from 'drizzle-orm'
import type { Database } from '../../../core/server/utils/db'
import type { AdminStats } from '../../shared'

function rowsOf<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows
}

interface Totals { opens: number, starts: number, completes: number, restarts: number, players: number }

/**
 * Analytics of the last `days` days (UTC days, today included). Counters come from the events log:
 * opens are every time an art was opened, starts and completes count once per attempt. `daily` has
 * an entry for every day, also the quiet ones, so a chart needs no gap filling.
 */
export async function loadStats(db: Database, days: number): Promise<AdminStats> {
  const since = sql`(date_trunc('day', now() AT TIME ZONE 'UTC') - make_interval(days => ${days - 1})) AT TIME ZONE 'UTC'`

  const [totals] = rowsOf<Totals>(await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE type = 'open')::int AS opens,
      count(*) FILTER (WHERE type = 'start')::int AS starts,
      count(*) FILTER (WHERE type = 'complete')::int AS completes,
      count(*) FILTER (WHERE type = 'restart')::int AS restarts,
      count(DISTINCT user_id)::int AS players
    FROM art_events
    WHERE created_at >= ${since}
  `))

  const perArt = rowsOf<AdminStats['arts'][number]>(await db.execute(sql`
    SELECT e.art_id AS id, a.title,
      count(*) FILTER (WHERE e.type = 'open')::int AS opens,
      count(*) FILTER (WHERE e.type = 'start')::int AS starts,
      count(*) FILTER (WHERE e.type = 'complete')::int AS completes,
      count(*) FILTER (WHERE e.type = 'restart')::int AS restarts
    FROM art_events e
    JOIN arts a ON a.id = e.art_id
    WHERE e.created_at >= ${since}
    GROUP BY e.art_id, a.title
    ORDER BY opens DESC, a.title
  `))

  const daily = rowsOf<AdminStats['daily'][number]>(await db.execute(sql`
    SELECT to_char(d.day AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
      count(e.id) FILTER (WHERE e.type = 'open')::int AS opens,
      count(e.id) FILTER (WHERE e.type = 'start')::int AS starts,
      count(e.id) FILTER (WHERE e.type = 'complete')::int AS completes,
      count(e.id) FILTER (WHERE e.type = 'restart')::int AS restarts
    FROM generate_series(${since}, now(), interval '1 day') AS d(day)
    LEFT JOIN art_events e ON e.created_at >= d.day AND e.created_at < d.day + interval '1 day'
    GROUP BY d.day
    ORDER BY d.day
  `))

  const countries = rowsOf<AdminStats['countries'][number]>(await db.execute(sql`
    SELECT country, count(*) FILTER (WHERE type = 'open')::int AS opens, count(DISTINCT user_id)::int AS players
    FROM art_events
    WHERE created_at >= ${since}
    GROUP BY country
    ORDER BY opens DESC, country
  `))

  return {
    totals: totals ?? { opens: 0, starts: 0, completes: 0, restarts: 0, players: 0 },
    arts: perArt,
    daily,
    countries,
  }
}
