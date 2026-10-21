import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

/**
 * The query-builder surface the services need. Both the Neon HTTP driver (the
 * app) and PGlite (tests) satisfy it, so services never know which one runs.
 *
 * The Neon HTTP driver has no interactive transactions: every service call
 * must be a single statement (or independent statements).
 */
export type Database = PgDatabase<PgQueryResultHKT>

let database: Database | undefined

/** The pooled Neon connection from DATABASE_URL, created on first use. */
export function useDb(): Database {
  if (!database) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set')
    database = drizzle({ client: neon(url) })
  }
  return database
}
