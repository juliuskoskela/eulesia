/**
 * Discovery Orchestrator
 *
 * Coordinates entity discovery across Europe — municipalities, counties,
 * regions, and federal states. Respects country-level operating modes
 * and rate limits.
 */

import { scraperDb, discoveryRuns } from "../../../db/scraper-db.js";
import { eq } from "drizzle-orm";
import {
  COUNTRY_CONFIGS,
  getCountryMode,
  getSupportedCountries,
} from "./registry-sources.js";
import { discoverCountry, discoverCountryFull } from "./probe.js";
import type { AdminLevel } from "./admin-entities.js";

export interface DiscoveryOptions {
  /** Specific countries to discover (default: all enabled) */
  countries?: string[];
  /** Max entities per country */
  limit?: number;
  /** Don't save to database */
  dryRun?: boolean;
  /** Only discover countries in these modes */
  modes?: ("production" | "test" | "discovery-only")[];
  /** Admin levels to discover (default: only municipalities) */
  adminLevels?: AdminLevel[];
  /** Include all admin levels (overrides adminLevels) */
  includeAllLevels?: boolean;
}

/**
 * Run discovery for multiple countries.
 */
export async function runDiscovery(options: DiscoveryOptions = {}): Promise<{
  countries: Record<string, { probed: number; found: number; saved: number }>;
}> {
  const countries = options.countries || getSupportedCountries();
  const allowedModes = options.modes || ["production", "discovery-only"];

  const results: Record<
    string,
    { probed: number; found: number; saved: number }
  > = {};

  for (const code of countries) {
    const config = COUNTRY_CONFIGS[code];
    if (!config) continue;

    const mode = getCountryMode(code);
    if (
      !allowedModes.includes(mode as "production" | "test" | "discovery-only")
    ) {
      console.log(`   [discovery] Skipping ${config.name}: mode=${mode}`);
      continue;
    }

    // Create discovery run record
    const [run] = await scraperDb
      .insert(discoveryRuns)
      .values({
        country: code,
        status: "running",
      })
      .returning({ id: discoveryRuns.id });

    try {
      // If admin levels requested, use full discovery (municipalities + higher levels)
      const useFullDiscovery =
        options.includeAllLevels ||
        (options.adminLevels && options.adminLevels.length > 0);

      const result = useFullDiscovery
        ? await discoverCountryFull(config, {
            limit: options.limit,
            dryRun: options.dryRun,
            adminLevels: options.includeAllLevels
              ? undefined
              : options.adminLevels,
          })
        : await discoverCountry(config, {
            limit: options.limit,
            dryRun: options.dryRun,
          });

      results[code] = {
        probed: result.probed,
        found: result.found,
        saved: result.saved,
      };

      // Update discovery run
      await scraperDb
        .update(discoveryRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          municipalitiesProbed: result.probed, // Legacy compat
          municipalitiesFound: result.found, // Legacy compat
          entitiesProbed: result.probed, // New generic field
          entitiesFound: result.found,
        })
        .where(eq(discoveryRuns.id, run.id));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`   [discovery] Error for ${config.name}: ${errMsg}`);

      await scraperDb
        .update(discoveryRuns)
        .set({
          status: "failed",
          completedAt: new Date(),
          error: errMsg.slice(0, 5000),
        })
        .where(eq(discoveryRuns.id, run.id));

      results[code] = { probed: 0, found: 0, saved: 0 };
    }
  }

  return { countries: results };
}

/**
 * Run discovery for a single country (convenience wrapper).
 */
export async function discoverSingleCountry(
  countryCode: string,
  options?: { limit?: number; dryRun?: boolean },
) {
  return runDiscovery({
    countries: [countryCode],
    limit: options?.limit,
    dryRun: options?.dryRun,
    modes: ["production", "test", "discovery-only"], // Allow all modes for single-country runs
  });
}

/**
 * Quick test: probe a single municipality URL.
 * Useful for manual testing without full discovery.
 */
export async function testProbe(
  url: string,
  systemHint?: string,
): Promise<{ ok: boolean; html?: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Eulesia/1.0 (civic platform; contact@eulesia.eu)",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return { ok: false };

    const html = await response.text();
    if (html.length < 100) return { ok: false };

    if (systemHint) {
      if (!html.toLowerCase().includes(systemHint.toLowerCase())) {
        return { ok: false };
      }
    }

    return { ok: true, html: html.slice(0, 5000) };
  } catch {
    return { ok: false };
  }
}
