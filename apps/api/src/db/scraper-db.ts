/**
 * Scraper Database Connection
 *
 * Separate Drizzle ORM instance for the scraper database.
 * Isolated from the main user database for security.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as scraperSchema from "./scraper-schema.js";

const connectionString =
  process.env.SCRAPER_DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/eulesia_scraper";

const client = postgres(connectionString);
export const scraperDb = drizzle(client, { schema: scraperSchema });

export * from "./scraper-schema.js";
