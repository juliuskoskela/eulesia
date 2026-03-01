import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/scraper-schema.ts',
  out: './src/db/scraper-migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.SCRAPER_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/eulesia_scraper'
  },
  verbose: true,
  strict: true
})
