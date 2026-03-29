/**
 * Entity URL Prober
 *
 * Probes known URL patterns for administrative entities (municipalities,
 * counties, regions, states) to discover which meeting system they use.
 * Evolved from discover-municipalities.ts.
 *
 * For each entity, tries all URL patterns for its country and admin level.
 * If a probe succeeds, the system type is identified and a
 * scraper_config entry is created with the appropriate template.
 */

import { scraperDb, scraperConfigs } from "../../../db/scraper-db.js";
import { eq, and } from "drizzle-orm";
import { getTemplate } from "../adaptive/templates.js";
import type { CountryConfig, UrlPattern } from "./registry-sources.js";
import type { AdminLevel, AdminEntity } from "./admin-entities.js";

const PROBE_TIMEOUT_MS = 8000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ProbeResult {
  municipalityName: string; // Legacy — entity name stored here for backward compat
  entityName?: string; // Generic entity name
  adminLevel?: AdminLevel; // 'municipality' | 'county' | 'region' | 'state'
  slug: string;
  country: string;
  systemType: string | null;
  url: string | null;
  confirmed: boolean;
  error?: string;
}

/**
 * Probe a single URL with timeout and optional confirmation.
 */
async function probeUrl(
  url: string,
  confirmPattern?: string,
): Promise<{ ok: boolean; html?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Eulesia/1.0 (civic platform; contact@eulesia.eu)",
      },
      redirect: "follow",
    });

    clearTimeout(timer);

    if (!response.ok) {
      return { ok: false };
    }

    const html = await response.text();

    // If we have a confirmation pattern, check for it
    if (confirmPattern) {
      if (!html.toLowerCase().includes(confirmPattern.toLowerCase())) {
        return { ok: false };
      }
    }

    // Basic validation: page should have some content
    if (html.length < 100) {
      return { ok: false };
    }

    return { ok: true, html };
  } catch {
    clearTimeout(timer);
    return { ok: false };
  }
}

/**
 * Probe a single municipality against all URL patterns for its country.
 * Returns the first match found.
 */
export async function probeMunicipality(
  name: string,
  slug: string,
  urlPatterns: UrlPattern[],
  country: string,
  delayMs: number,
): Promise<ProbeResult> {
  for (const pattern of urlPatterns) {
    const url = pattern.buildUrl(slug);

    const result = await probeUrl(url, pattern.confirmPattern);
    await sleep(delayMs);

    if (result.ok) {
      return {
        municipalityName: name,
        slug,
        country,
        systemType: pattern.system,
        url,
        confirmed: true,
      };
    }
  }

  return {
    municipalityName: name,
    slug,
    country,
    systemType: null,
    url: null,
    confirmed: false,
  };
}

/**
 * Check if a scraper config already exists for this municipality+country.
 */
async function configExists(
  municipalityName: string,
  country: string,
): Promise<boolean> {
  const existing = await scraperDb
    .select({ id: scraperConfigs.id })
    .from(scraperConfigs)
    .where(
      and(
        eq(scraperConfigs.municipalityName, municipalityName),
        eq(scraperConfigs.country, country),
      ),
    )
    .limit(1);

  return existing.length > 0;
}

/**
 * Save a discovered scraper config to the database.
 */
export async function saveDiscoveredConfig(
  result: ProbeResult,
): Promise<string | null> {
  if (!result.confirmed || !result.url || !result.systemType) return null;

  // Check if already exists
  if (await configExists(result.municipalityName, result.country)) {
    console.log(
      `   [probe] Skipping ${result.municipalityName} (${result.country}) — already configured`,
    );
    return null;
  }

  // Get template config for the detected system
  const template = getTemplate(result.systemType);
  if (!template) {
    console.log(`   [probe] No template for system type: ${result.systemType}`);
    return null;
  }

  const [inserted] = await scraperDb
    .insert(scraperConfigs)
    .values({
      municipalityName: result.municipalityName,
      country: result.country,
      systemType: result.systemType,
      baseUrl: result.url,
      discoveredBy: "probe",
      config: template,
      configGeneratedBy: "template",
      status: "active",
      contentLanguage: getLanguageForCountry(result.country),
    })
    .returning({ id: scraperConfigs.id });

  console.log(
    `   [probe] Saved config for ${result.municipalityName} (${result.country}, ${result.systemType})`,
  );
  return inserted.id;
}

function getLanguageForCountry(country: string): string {
  const map: Record<string, string> = {
    FI: "fi",
    EE: "et",
    DE: "de",
    SE: "sv",
    FR: "fr",
    NL: "nl",
    NO: "no",
    DK: "da",
    AT: "de",
    PL: "pl",
    CZ: "cs",
    ES: "es",
    IT: "it",
    PT: "pt",
  };
  return map[country] || "en";
}

/**
 * Run discovery for an entire country.
 * Returns summary of results.
 */
export async function discoverCountry(
  config: CountryConfig,
  options?: { limit?: number; dryRun?: boolean },
): Promise<{
  probed: number;
  found: number;
  saved: number;
  results: ProbeResult[];
}> {
  const limit = options?.limit ?? config.probeLimit;
  const municipalities = config.municipalities.slice(0, limit);

  console.log(
    `\n🔍 Discovery: ${config.name} (${municipalities.length} municipalities)`,
  );

  const results: ProbeResult[] = [];
  let found = 0;
  let saved = 0;

  for (const muni of municipalities) {
    const result = await probeMunicipality(
      muni.name,
      muni.slug,
      config.urlPatterns,
      config.code,
      config.probeDelayMs,
    );

    results.push(result);

    if (result.confirmed) {
      found++;
      console.log(`   ✅ ${muni.name}: ${result.systemType} (${result.url})`);

      if (!options?.dryRun) {
        const id = await saveDiscoveredConfig(result);
        if (id) saved++;
      }
    } else {
      console.log(`   ❌ ${muni.name}: not found`);
    }
  }

  console.log(
    `\n📊 Discovery complete: ${found}/${municipalities.length} found, ${saved} saved`,
  );
  return { probed: municipalities.length, found, saved, results };
}

/**
 * Geocode a municipality using Nominatim.
 * Returns OSM data for integration with the locations table.
 */
export async function geocodeMunicipality(
  name: string,
  country: string,
): Promise<{
  osmId: number;
  lat: number;
  lon: number;
  displayName: string;
  adminLevel?: number;
} | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${name}, ${country}`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("featuretype", "city");
  url.searchParams.set("addressdetails", "1");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Eulesia/1.0 (civic platform; contact@eulesia.eu)",
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const result = data[0];
    return {
      osmId: parseInt(result.osm_id, 10),
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      displayName: result.display_name,
      adminLevel: result.address?.admin_level
        ? parseInt(result.address.admin_level, 10)
        : undefined,
    };
  } catch {
    return null;
  }
}

// ============================================
// Entity-level probing (supports all admin levels)
// ============================================

/**
 * Probe a single entity (municipality, county, region, or state) against URL patterns.
 * Wraps probeMunicipality with admin level awareness.
 */
export async function probeEntity(
  entity: AdminEntity,
  urlPatterns: UrlPattern[],
  country: string,
  delayMs: number,
): Promise<ProbeResult> {
  for (const pattern of urlPatterns) {
    const url = pattern.buildUrl(entity.slug);

    const result = await probeUrl(url, pattern.confirmPattern);
    await sleep(delayMs);

    if (result.ok) {
      return {
        municipalityName: entity.name, // Legacy compat
        entityName: entity.name,
        adminLevel: entity.adminLevel,
        slug: entity.slug,
        country,
        systemType: pattern.system,
        url,
        confirmed: true,
      };
    }
  }

  return {
    municipalityName: entity.name,
    entityName: entity.name,
    adminLevel: entity.adminLevel,
    slug: entity.slug,
    country,
    systemType: null,
    url: null,
    confirmed: false,
  };
}

/**
 * Save a discovered entity config — supports admin levels.
 */
export async function saveDiscoveredEntityConfig(
  result: ProbeResult,
): Promise<string | null> {
  if (!result.confirmed || !result.url || !result.systemType) return null;

  const entityName = result.entityName || result.municipalityName;
  const adminLevel = result.adminLevel || "municipality";

  // Check if already exists (entity name + country + admin level)
  const existing = await scraperDb
    .select({ id: scraperConfigs.id })
    .from(scraperConfigs)
    .where(
      and(
        eq(scraperConfigs.municipalityName, entityName),
        eq(scraperConfigs.country, result.country),
        eq(scraperConfigs.adminLevel, adminLevel),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    console.log(
      `   [probe] Skipping ${entityName} (${result.country}/${adminLevel}) — already configured`,
    );
    return null;
  }

  const template = getTemplate(result.systemType);
  if (!template) {
    console.log(`   [probe] No template for system type: ${result.systemType}`);
    return null;
  }

  const [inserted] = await scraperDb
    .insert(scraperConfigs)
    .values({
      municipalityName: entityName, // Legacy column
      entityName: entityName, // New column
      adminLevel: adminLevel,
      country: result.country,
      systemType: result.systemType,
      baseUrl: result.url,
      discoveredBy: "probe",
      config: template,
      configGeneratedBy: "template",
      status: "active",
      contentLanguage: getLanguageForCountry(result.country),
    })
    .returning({ id: scraperConfigs.id });

  console.log(
    `   [probe] Saved config for ${entityName} (${result.country}/${adminLevel}, ${result.systemType})`,
  );
  return inserted.id;
}

/**
 * Run full discovery for a country — municipalities + all admin entities.
 * Discovers each admin level using its own URL patterns.
 */
export async function discoverCountryFull(
  config: CountryConfig,
  options?: { limit?: number; dryRun?: boolean; adminLevels?: AdminLevel[] },
): Promise<{
  probed: number;
  found: number;
  saved: number;
  results: ProbeResult[];
}> {
  // First: discover municipalities (existing behavior)
  const muniResults = await discoverCountry(config, options);
  let totalProbed = muniResults.probed;
  let totalFound = muniResults.found;
  let totalSaved = muniResults.saved;
  const allResults = [...muniResults.results];

  // Then: discover higher admin levels if configured
  if (config.adminEntities && config.adminUrlPatterns) {
    const levelFilter = options?.adminLevels;

    for (const entity of config.adminEntities) {
      // Skip if admin level filter is active and this level is excluded
      if (levelFilter && !levelFilter.includes(entity.adminLevel)) continue;

      const patterns = config.adminUrlPatterns[entity.adminLevel];
      if (!patterns || patterns.length === 0) continue;

      const result = await probeEntity(
        entity,
        patterns,
        config.code,
        config.probeDelayMs,
      );
      allResults.push(result);
      totalProbed++;

      if (result.confirmed) {
        totalFound++;
        console.log(
          `   ✅ [${entity.adminLevel}] ${entity.name}: ${result.systemType} (${result.url})`,
        );

        if (!options?.dryRun) {
          const id = await saveDiscoveredEntityConfig(result);
          if (id) totalSaved++;
        }
      } else {
        console.log(`   ❌ [${entity.adminLevel}] ${entity.name}: not found`);
      }
    }
  }

  console.log(
    `\n📊 Full discovery complete: ${totalFound}/${totalProbed} found, ${totalSaved} saved`,
  );
  return {
    probed: totalProbed,
    found: totalFound,
    saved: totalSaved,
    results: allResults,
  };
}
