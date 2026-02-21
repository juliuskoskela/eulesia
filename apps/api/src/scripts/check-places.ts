#!/usr/bin/env node
import { db, places } from "../db/index.js";
import { sql, count } from "drizzle-orm";

interface QueryRow extends Record<string, unknown> {
  source?: string;
  category?: string;
  count: string | number;
}

async function main() {
  const result = await db.execute<QueryRow>(sql`
    SELECT
      source,
      COUNT(*) as count
    FROM places
    GROUP BY source
  `);
  console.log("Places by source:");
  const rows: QueryRow[] = Array.isArray(result) ? result : [];
  rows.forEach((r) => console.log(`  ${r.source}: ${r.count}`));

  const total = await db.select({ count: count() }).from(places);
  console.log("\nTotal places:", total[0].count);

  const byCategory = await db.execute<QueryRow>(sql`
    SELECT category, COUNT(*) as count
    FROM places
    GROUP BY category
    ORDER BY count DESC
    LIMIT 10
  `);
  console.log("\nTop categories:");
  const catRows: QueryRow[] = Array.isArray(byCategory) ? byCategory : [];
  catRows.forEach((r) => console.log(`  ${r.category}: ${r.count}`));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
