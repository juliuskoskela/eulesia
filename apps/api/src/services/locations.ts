/**
 * Location Service
 *
 * Handles hybrid search (DB + Nominatim) and location activation logic.
 * Locations are "activated" (created in DB) when content is created for them.
 */

import { db, locations, type Location } from "../db/index.js";
import { eq, ilike, or, sql, and, inArray } from "drizzle-orm";
import { indexLocation, type LocationDocument } from "./search/meilisearch.js";
import {
  searchNominatim,
  lookupNominatim,
  mapNominatimToLocationType,
  mapNominatimToAdminLevel,
  extractLocalizedNames,
  extractBounds,
  extractPopulation,
  normalizeOsmType,
  type OsmType,
  type NominatimResult,
} from "./nominatim.js";

export interface LocationSearchOptions {
  country?: string; // ISO 3166-1 alpha-2 (e.g., 'FI', 'DE')
  types?: string[]; // Filter by location type ('municipality', 'village', etc.)
  limit?: number; // Max results (default 10)
  includeNominatim?: boolean; // Whether to search Nominatim if few local results
}

export interface LocationResult {
  id: string | null; // DB ID (null if from Nominatim only)
  osmId: number;
  osmType: OsmType;
  name: string;
  nameFi: string | null;
  nameSv: string | null;
  nameEn: string | null;
  displayName: string;
  type: string; // 'municipality', 'village', 'region', etc.
  adminLevel: number | null;
  country: string;
  latitude: number;
  longitude: number;
  bounds: { south: number; north: number; west: number; east: number } | null;
  population: number | null;
  status: "active" | "available"; // 'active' = in DB, 'available' = from Nominatim
  contentCount: number;
  parent: {
    name: string;
    type: string;
  } | null;
}

export interface LocationHierarchy {
  name: string;
  type: string;
  adminLevel: number | null;
}

/**
 * Hybrid search: Local DB + Nominatim
 *
 * 1. First searches local database
 * 2. If fewer than 5 results, also searches Nominatim
 * 3. Deduplicates by OSM ID, prioritizing local results
 */
export async function searchLocations(
  query: string,
  options: LocationSearchOptions = {},
): Promise<{
  results: LocationResult[];
  source: "cache" | "nominatim" | "mixed";
}> {
  const limit = options.limit || 10;
  const country = options.country?.toUpperCase() || "FI";
  const includeNominatim = options.includeNominatim !== false;

  // 1. Search local database
  const localResults = await searchLocalDatabase(query, {
    ...options,
    limit,
    country,
  });

  // If we have enough local results, return them
  if (localResults.length >= 5 || !includeNominatim) {
    return {
      results: localResults.slice(0, limit),
      source: "cache",
    };
  }

  // 2. Also search Nominatim for additional results
  const nominatimResults = await searchNominatimLocations(query, {
    country: country.toLowerCase(),
    limit: limit - localResults.length,
    types: options.types,
  });

  // 3. Merge and deduplicate (prefer local results)
  const merged = mergeResults(localResults, nominatimResults);

  return {
    results: merged.slice(0, limit),
    source:
      localResults.length > 0 && nominatimResults.length > 0
        ? "mixed"
        : nominatimResults.length > 0
          ? "nominatim"
          : "cache",
  };
}

/**
 * Search local database for locations
 */
async function searchLocalDatabase(
  query: string,
  options: { country: string; limit: number; types?: string[] },
): Promise<LocationResult[]> {
  const searchTerm = `%${query}%`;

  const conditions = [
    or(
      ilike(locations.name, searchTerm),
      ilike(locations.nameLocal, searchTerm),
      ilike(locations.nameFi, searchTerm),
      ilike(locations.nameSv, searchTerm),
      ilike(locations.nameEn, searchTerm),
    ),
  ];

  // Filter by country
  conditions.push(eq(locations.country, options.country));

  // Filter by types if specified
  if (options.types && options.types.length > 0) {
    conditions.push(inArray(locations.type, options.types));
  }

  const results = await db
    .select()
    .from(locations)
    .where(and(...conditions))
    .orderBy(
      // Prioritize exact matches
      sql`CASE WHEN LOWER(${locations.name}) = LOWER(${query}) THEN 0 ELSE 1 END`,
      // Then by content count
      sql`${locations.contentCount} DESC NULLS LAST`,
      // Then by name
      locations.name,
    )
    .limit(options.limit);

  // Get parent locations for hierarchy info
  const parentIds = results.map((r) => r.parentId).filter(Boolean) as string[];
  let parents: Map<string, Location> = new Map();

  if (parentIds.length > 0) {
    const parentResults = await db
      .select()
      .from(locations)
      .where(sql`${locations.id} = ANY(${parentIds})`);

    parents = new Map(parentResults.map((p) => [p.id, p]));
  }

  return results.map((loc) => ({
    id: loc.id,
    osmId: loc.osmId || 0,
    osmType: (loc.osmType as OsmType) || "relation",
    name: loc.name,
    nameFi: loc.nameFi || null,
    nameSv: loc.nameSv || null,
    nameEn: loc.nameEn || null,
    displayName: buildDisplayName(loc, parents.get(loc.parentId || "")),
    type: loc.type || "municipality",
    adminLevel: loc.adminLevel,
    country: loc.country || "FI",
    latitude: parseFloat(loc.latitude?.toString() || "0"),
    longitude: parseFloat(loc.longitude?.toString() || "0"),
    bounds: loc.bounds as {
      south: number;
      north: number;
      west: number;
      east: number;
    } | null,
    population: loc.population || null,
    status: "active" as const,
    contentCount: loc.contentCount || 0,
    parent:
      loc.parentId && parents.get(loc.parentId)
        ? {
            name: parents.get(loc.parentId)!.name,
            type: parents.get(loc.parentId)!.type || "region",
          }
        : null,
  }));
}

/**
 * Search Nominatim and map results to LocationResult format
 */
async function searchNominatimLocations(
  query: string,
  options: { country: string; limit: number; types?: string[] },
): Promise<LocationResult[]> {
  try {
    const results = await searchNominatim(query, {
      country: options.country,
      limit: options.limit + 5, // Get a few extra to filter
    });

    // Filter by types if specified
    let filtered = results;
    if (options.types && options.types.length > 0) {
      filtered = results.filter((r) => {
        const locType = mapNominatimToLocationType(r);
        return options.types!.includes(locType);
      });
    }

    // Filter to only administrative boundaries and places
    filtered = filtered.filter(
      (r) =>
        r.category === "boundary" ||
        r.category === "place" ||
        [
          "city",
          "town",
          "village",
          "municipality",
          "county",
          "state",
          "region",
        ].includes(r.type),
    );

    return filtered.slice(0, options.limit).map((r) => mapNominatimResult(r));
  } catch (error) {
    console.error("Nominatim search error:", error);
    return [];
  }
}

/**
 * Map a Nominatim result to our LocationResult format
 */
function mapNominatimResult(result: NominatimResult): LocationResult {
  const names = extractLocalizedNames(result);
  const bounds = extractBounds(result);
  const population = extractPopulation(result);
  const type = mapNominatimToLocationType(result);
  const adminLevel = mapNominatimToAdminLevel(result);

  // Extract parent info from address
  const parent = extractParentFromAddress(result, type);

  return {
    id: null,
    osmId: result.osm_id,
    osmType: normalizeOsmType(result.osm_type),
    name: names.name,
    nameFi: names.nameFi,
    nameSv: names.nameSv,
    nameEn: names.nameEn,
    displayName: result.display_name,
    type,
    adminLevel,
    country: result.address.country_code?.toUpperCase() || "FI",
    latitude: parseFloat(result.lat),
    longitude: parseFloat(result.lon),
    bounds,
    population,
    status: "available",
    contentCount: 0,
    parent,
  };
}

/**
 * Extract parent location info from Nominatim address
 */
function extractParentFromAddress(
  result: NominatimResult,
  childType: string,
): { name: string; type: string } | null {
  const address = result.address;

  // For municipalities, parent is region/state
  if (childType === "municipality" || childType === "village") {
    if (address.state) {
      return { name: address.state, type: "region" };
    }
    if (address.region) {
      return { name: address.region, type: "region" };
    }
    if (address.county) {
      return { name: address.county, type: "region" };
    }
  }

  // For regions, parent is country
  if (childType === "region") {
    if (address.country) {
      return { name: address.country, type: "country" };
    }
  }

  return null;
}

/**
 * Merge local and Nominatim results, deduplicating by OSM ID
 */
function mergeResults(
  localResults: LocationResult[],
  nominatimResults: LocationResult[],
): LocationResult[] {
  const seen = new Set(localResults.map((r) => r.osmId));
  const merged = [...localResults];

  for (const result of nominatimResults) {
    if (!seen.has(result.osmId)) {
      merged.push(result);
      seen.add(result.osmId);
    }
  }

  return merged;
}

/**
 * Build display name from location and optional parent
 */
const COUNTRY_NAMES: Record<string, string> = {
  FI: "Suomi",
  SE: "Sverige",
  EE: "Eesti",
  DE: "Deutschland",
  FR: "France",
  NL: "Nederland",
  IT: "Italia",
  ES: "España",
};

function buildDisplayName(location: Location, parent?: Location): string {
  const parts = [location.name];

  if (parent) {
    parts.push(parent.name);
  }

  if (location.country) {
    parts.push(COUNTRY_NAMES[location.country] || location.country);
  }

  return parts.join(", ");
}

/**
 * Activate a location by OSM ID
 *
 * Creates a location record in the database if it doesn't exist.
 * Called when content (thread, club, etc.) is created for a location.
 */
export async function activateLocation(
  osmType: OsmType,
  osmId: number,
): Promise<Location> {
  // Check if already exists
  const existing = await findLocationByOsmId(osmId);
  if (existing) {
    return existing;
  }

  // Fetch from Nominatim
  const nominatimResult = await lookupNominatim(osmType, osmId);
  if (!nominatimResult) {
    throw new Error(`Location not found in Nominatim: ${osmType}/${osmId}`);
  }

  // Create in database
  return createLocationFromNominatim(nominatimResult);
}

/**
 * Find a location by OSM ID
 */
export async function findLocationByOsmId(
  osmId: number,
): Promise<Location | null> {
  const [result] = await db
    .select()
    .from(locations)
    .where(eq(locations.osmId, osmId))
    .limit(1);

  return result || null;
}

/**
 * Find a location by database ID
 */
export async function findLocationById(id: string): Promise<Location | null> {
  const [result] = await db
    .select()
    .from(locations)
    .where(eq(locations.id, id))
    .limit(1);

  return result || null;
}

/**
 * Create a location from Nominatim result
 */
async function createLocationFromNominatim(
  result: NominatimResult,
): Promise<Location> {
  const names = extractLocalizedNames(result);
  const bounds = extractBounds(result);
  const population = extractPopulation(result);
  const type = mapNominatimToLocationType(result);
  const adminLevel = mapNominatimToAdminLevel(result);

  // Try to find or create parent location
  let parentId: string | null = null;
  const parentInfo = extractParentFromAddress(result, type);

  if (parentInfo && result.address) {
    // Try to find existing parent by name
    const [existingParent] = await db
      .select()
      .from(locations)
      .where(
        and(
          eq(locations.name, parentInfo.name),
          eq(locations.type, parentInfo.type),
          eq(
            locations.country,
            result.address.country_code?.toUpperCase() || "FI",
          ),
        ),
      )
      .limit(1);

    if (existingParent) {
      parentId = existingParent.id;
    }
    // Note: We don't recursively create parents to avoid Nominatim rate limiting
  }

  const [newLocation] = await db
    .insert(locations)
    .values({
      osmId: result.osm_id,
      osmType: normalizeOsmType(result.osm_type),
      name: names.name,
      nameLocal: names.name,
      nameFi: names.nameFi,
      nameSv: names.nameSv,
      nameEn: names.nameEn,
      type,
      adminLevel,
      parentId,
      country: result.address.country_code?.toUpperCase() || "FI",
      latitude: result.lat,
      longitude: result.lon,
      bounds,
      population,
      status: "active",
      contentCount: 0,
      nominatimUpdatedAt: new Date(),
    })
    .returning();

  // Index in Meilisearch for global search
  try {
    const locationDoc: LocationDocument = {
      id: newLocation.id,
      osmId: newLocation.osmId || 0,
      osmType: newLocation.osmType || "relation",
      name: newLocation.name,
      nameFi: newLocation.nameFi || undefined,
      nameSv: newLocation.nameSv || undefined,
      nameEn: newLocation.nameEn || undefined,
      displayName: result.display_name,
      type: newLocation.type || "municipality",
      adminLevel: newLocation.adminLevel || undefined,
      country: newLocation.country || "FI",
      latitude: parseFloat(newLocation.latitude?.toString() || "0"),
      longitude: parseFloat(newLocation.longitude?.toString() || "0"),
      population: newLocation.population || undefined,
      contentCount: 0,
      parentName: parentInfo?.name,
    };
    await indexLocation(locationDoc);
  } catch (error) {
    // Don't fail if indexing fails - location is still in DB
    console.error("Failed to index location in Meilisearch:", error);
  }

  return newLocation;
}

/**
 * Increment content count for a location
 */
export async function incrementContentCount(locationId: string): Promise<void> {
  await db
    .update(locations)
    .set({
      contentCount: sql`COALESCE(${locations.contentCount}, 0) + 1`,
    })
    .where(eq(locations.id, locationId));
}

/**
 * Decrement content count for a location
 */
export async function decrementContentCount(locationId: string): Promise<void> {
  await db
    .update(locations)
    .set({
      contentCount: sql`GREATEST(COALESCE(${locations.contentCount}, 0) - 1, 0)`,
    })
    .where(eq(locations.id, locationId));
}

/**
 * Resolve location from input (either locationId or osmId)
 *
 * Used when creating threads, clubs, etc. to resolve the location.
 */
export async function resolveLocation(input: {
  locationId?: string;
  locationOsmId?: number;
  locationOsmType?: string;
}): Promise<string | null> {
  // Option A: Direct location ID
  if (input.locationId) {
    const location = await findLocationById(input.locationId);
    if (!location) {
      throw new Error(`Location not found: ${input.locationId}`);
    }
    return location.id;
  }

  // Option B: OSM ID (needs activation)
  if (input.locationOsmId && input.locationOsmType) {
    const osmType = normalizeOsmType(input.locationOsmType);
    const location = await activateLocation(osmType, input.locationOsmId);
    return location.id;
  }

  return null;
}

/**
 * Get location hierarchy (parents up to country)
 */
export async function getLocationHierarchy(
  locationId: string,
): Promise<LocationHierarchy[]> {
  const hierarchy: LocationHierarchy[] = [];
  let currentId: string | null = locationId;

  while (currentId) {
    const [location] = await db
      .select()
      .from(locations)
      .where(eq(locations.id, currentId))
      .limit(1);

    if (!location) break;

    hierarchy.push({
      name: location.name,
      type: location.type || "district",
      adminLevel: location.adminLevel,
    });

    currentId = location.parentId;
  }

  return hierarchy.reverse(); // Country first
}

/**
 * Lookup location details by OSM type and ID
 */
export async function lookupLocation(
  osmType: OsmType,
  osmId: number,
): Promise<LocationResult | null> {
  // First check database
  const existing = await findLocationByOsmId(osmId);
  if (existing) {
    // Get parent info
    let parent: { name: string; type: string } | null = null;
    let parentLoc: Location | null = null;
    if (existing.parentId) {
      parentLoc = await findLocationById(existing.parentId);
      if (parentLoc) {
        parent = { name: parentLoc.name, type: parentLoc.type || "region" };
      }
    }

    return {
      id: existing.id,
      osmId: existing.osmId || osmId,
      osmType: (existing.osmType as OsmType) || osmType,
      name: existing.name,
      nameFi: existing.nameFi || null,
      nameSv: existing.nameSv || null,
      nameEn: existing.nameEn || null,
      displayName: buildDisplayName(existing, parentLoc || undefined),
      type: existing.type || "municipality",
      adminLevel: existing.adminLevel,
      country: existing.country || "FI",
      latitude: parseFloat(existing.latitude?.toString() || "0"),
      longitude: parseFloat(existing.longitude?.toString() || "0"),
      bounds: existing.bounds as {
        south: number;
        north: number;
        west: number;
        east: number;
      } | null,
      population: existing.population || null,
      status: "active",
      contentCount: existing.contentCount || 0,
      parent,
    };
  }

  // Fetch from Nominatim
  const nominatimResult = await lookupNominatim(osmType, osmId);
  if (!nominatimResult) {
    return null;
  }

  return mapNominatimResult(nominatimResult);
}
