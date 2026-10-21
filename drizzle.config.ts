import { defineConfig } from 'drizzle-kit'

// The db:* scripts start drizzle-kit with Node's `--env-file-if-exists=.env`,
// so DATABASE_URL_UNPOOLED comes from .env locally and from the environment on Vercel.
export default defineConfig({
  out: './layers/core/server/db/migrations',
  schema: './layers/core/server/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    // Neon: migrations use the direct (non-pooled) connection string; the app uses the pooled DATABASE_URL.
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
})
