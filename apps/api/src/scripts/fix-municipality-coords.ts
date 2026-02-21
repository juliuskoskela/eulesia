/**
 * Fix missing municipality coordinates
 *
 * Fetches coordinates from Nominatim for all municipalities
 * that have NULL latitude/longitude in the database.
 *
 * Usage: npx tsx src/scripts/fix-municipality-coords.ts
 *
 * Rate limiting is handled by the Nominatim service (1.1s between requests).
 * With ~60 municipalities this takes about 1-2 minutes.
 */

import "dotenv/config";
import { db, municipalities } from "../db/index.js";
import { eq, and, isNull, notLike } from "drizzle-orm";
import {
  searchNominatim,
  extractBounds,
  extractPopulation,
} from "../services/nominatim.js";

async function fixMunicipalityCoords() {
  // Get all municipalities without coordinates (exclude hyvinvointialueet)
  const missing = await db
    .select({ id: municipalities.id, name: municipalities.name })
    .from(municipalities)
    .where(
      and(
        isNull(municipalities.latitude),
        notLike(municipalities.name, "%hyvinvointialue%"),
      ),
    )
    .orderBy(municipalities.name);

  console.log(`Found ${missing.length} municipalities without coordinates\n`);

  if (missing.length === 0) {
    console.log("Nothing to do!");
    process.exit(0);
  }

  let updated = 0;
  let failed = 0;

  for (const muni of missing) {
    try {
      // Search Nominatim for this municipality in Finland
      let results = await searchNominatim(muni.name, {
        country: "fi",
        limit: 3,
        featuretype: "city",
      });

      // Retry with "kunta" suffix if no results
      if (results.length === 0) {
        results = await searchNominatim(`${muni.name} kunta`, {
          country: "fi",
          limit: 3,
        });
      }

      if (results.length === 0) {
        console.log(`  FAIL: ${muni.name} (no Nominatim results)`);
        failed++;
        continue;
      }

      const result = results[0];
      const bounds = extractBounds(result);
      const population = extractPopulation(result);

      // Update using Drizzle ORM with parameterized query
      await db
        .update(municipalities)
        .set({
          latitude: result.lat,
          longitude: result.lon,
          ...(bounds ? { bounds } : {}),
          ...(population ? { population } : {}),
        })
        .where(
          and(eq(municipalities.id, muni.id), isNull(municipalities.latitude)),
        );

      console.log(`  OK: ${muni.name} -> ${result.lat}, ${result.lon}`);
      updated++;
    } catch (error) {
      console.error(
        `  ERROR: ${muni.name}:`,
        error instanceof Error ? error.message : error,
      );
      failed++;
    }
  }

  console.log(`\nDone! Updated: ${updated}, Failed: ${failed}`);
  process.exit(0);
}

fixMunicipalityCoords().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
