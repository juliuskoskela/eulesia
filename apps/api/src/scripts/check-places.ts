#!/usr/bin/env node
import { db, places } from '../db/index.js'
import { sql, count } from 'drizzle-orm'

async function main() {
  const result = await db.execute(sql`
    SELECT
      source,
      COUNT(*) as count
    FROM places
    GROUP BY source
  `)
  console.log('Places by source:')
  const rows = Array.isArray(result) ? result : result.rows || []
  rows.forEach((r: Record<string, unknown>) => console.log(`  ${r.source}: ${r.count}`))

  const total = await db.select({ count: count() }).from(places)
  console.log('\nTotal places:', total[0].count)

  const byCategory = await db.execute(sql`
    SELECT category, COUNT(*) as count
    FROM places
    GROUP BY category
    ORDER BY count DESC
    LIMIT 10
  `)
  console.log('\nTop categories:')
  const catRows = Array.isArray(byCategory) ? byCategory : byCategory.rows || []
  catRows.forEach((r: Record<string, unknown>) => console.log(`  ${r.category}: ${r.count}`))
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
