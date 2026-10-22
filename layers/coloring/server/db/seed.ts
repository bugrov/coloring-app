import { readFile } from 'node:fs/promises'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { seedBuiltinArts, type BuiltinArtSource } from '../services/seed'

/** Gallery order, first card first. */
const BUILTIN_ARTS = [
  { key: 'octopus', title: 'Осьминог' },
  { key: 'cat', title: 'Кот' },
  { key: 'house', title: 'Дом' },
]

// Run by `pnpm db:seed` (and in the Vercel build after the migrations). Idempotent.
const url = process.env.DATABASE_URL_UNPOOLED

if (!url) throw new Error('DATABASE_URL_UNPOOLED is not set')

const sources: BuiltinArtSource[] = await Promise.all(BUILTIN_ARTS.map(async art => ({
  ...art,
  svg: await readFile(new URL(`../assets/arts/${art.key}.svg`, import.meta.url), 'utf8'),
})))

await seedBuiltinArts(drizzle({ client: neon(url) }), sources)
process.stdout.write(`Seeded ${sources.length} built-in arts\n`)
