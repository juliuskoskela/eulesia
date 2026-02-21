/**
 * Nominatim API Service
 *
 * Provides access to OpenStreetMap's Nominatim geocoding service
 * for searching and looking up locations across Europe.
 *
 * Rate limiting: Max 1 request/second (Nominatim policy)
 * User-Agent: Required by Nominatim ToS
 */

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const USER_AGENT = "Eulesia/1.0 (https://eulesia.eu contact@eulesia.eu)";
const RATE_LIMIT_MS = 1100; // Slightly over 1 second to be safe

// Track last request time for rate limiting
let lastRequestTime = 0;

export type OsmType = "node" | "way" | "relation";

export interface NominatimAddress {
  municipality?: string;
  town?: string;
  city?: string;
  village?: string;
  hamlet?: string;
  county?: string;
  state?: string;
  region?: string;
  country?: string;
  country_code?: string;
  postcode?: string;
  [key: string]: string | undefined;
}

export interface NominatimResult {
  place_id: number;
  osm_type: string;
  osm_id: number;
  licence: string;
  lat: string;
  lon: string;
  category: string;
  type: string;
  place_rank: number;
  importance: number;
  addresstype: string;
  name: string;
  display_name: string;
  address: NominatimAddress;
  boundingbox: [string, string, string, string]; // [south, north, west, east]
  extratags?: {
    "name:fi"?: string;
    "name:sv"?: string;
    "name:en"?: string;
    population?: string;
    wikidata?: string;
    wikipedia?: string;
    website?: string;
    [key: string]: string | undefined;
  };
  namedetails?: {
    name?: string;
    "name:fi"?: string;
    "name:sv"?: string;
    "name:en"?: string;
    [key: string]: string | undefined;
  };
}

export interface NominatimSearchOptions {
  country?: string; // ISO 3166-1 alpha-2 country code (e.g., 'fi', 'de')
  limit?: number; // Max results (default 10)
  addressdetails?: boolean; // Include address breakdown
  extratags?: boolean; // Include extra tags (population, etc.)
  namedetails?: boolean; // Include name variants
  featuretype?: "country" | "state" | "city" | "settlement"; // Filter by feature type
}

export interface NominatimLookupOptions {
  addressdetails?: boolean;
  extratags?: boolean;
  namedetails?: boolean;
}

/**
 * Rate limiter - ensures we don't exceed Nominatim's 1 request/second limit
 */
async function rateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest),
    );
  }
  lastRequestTime = Date.now();
}

/**
 * Make a rate-limited request to Nominatim
 */
async function nominatimFetch(url: string): Promise<Response> {
  await rateLimit();

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      "Accept-Language": "fi,en",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Nominatim request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response;
}

/**
 * Search for locations by name
 *
 * @param query - Search term (e.g., "Toholampi", "Helsinki")
 * @param options - Search options (country filter, limit, etc.)
 * @returns Array of matching locations
 *
 * @example
 * const results = await searchNominatim('Toholampi', { country: 'fi', limit: 5 })
 */
export async function searchNominatim(
  query: string,
  options: NominatimSearchOptions = {},
): Promise<NominatimResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: (options.limit || 10).toString(),
  });

  if (options.country) {
    params.set("countrycodes", options.country.toLowerCase());
  }
  if (options.addressdetails !== false) {
    params.set("addressdetails", "1");
  }
  if (options.extratags !== false) {
    params.set("extratags", "1");
  }
  if (options.namedetails !== false) {
    params.set("namedetails", "1");
  }
  if (options.featuretype) {
    params.set("featuretype", options.featuretype);
  }

  const url = `${NOMINATIM_BASE_URL}/search?${params.toString()}`;
  const response = await nominatimFetch(url);
  const data = (await response.json()) as NominatimResult[];

  return data;
}

/**
 * Look up a specific location by OSM ID
 *
 * @param osmType - Type of OSM element ('node', 'way', 'relation')
 * @param osmId - OSM ID number
 * @param options - Lookup options
 * @returns Location details or null if not found
 *
 * @example
 * const location = await lookupNominatim('relation', 123456)
 */
export async function lookupNominatim(
  osmType: OsmType,
  osmId: number,
  options: NominatimLookupOptions = {},
): Promise<NominatimResult | null> {
  // Nominatim lookup uses format: R123456 (relation), N123456 (node), W123456 (way)
  const osmIdString = `${osmType.charAt(0).toUpperCase()}${osmId}`;

  const params = new URLSearchParams({
    osm_ids: osmIdString,
    format: "jsonv2",
  });

  if (options.addressdetails !== false) {
    params.set("addressdetails", "1");
  }
  if (options.extratags !== false) {
    params.set("extratags", "1");
  }
  if (options.namedetails !== false) {
    params.set("namedetails", "1");
  }

  const url = `${NOMINATIM_BASE_URL}/lookup?${params.toString()}`;
  const response = await nominatimFetch(url);
  const data = (await response.json()) as NominatimResult[];

  return data.length > 0 ? data[0] : null;
}

/**
 * Reverse geocode coordinates to a location
 *
 * @param lat - Latitude
 * @param lon - Longitude
 * @param zoom - Level of detail (3=country, 10=city, 14=suburb, 18=building)
 * @returns Nearest location or null
 *
 * @example
 * const location = await reverseNominatim(63.77, 24.25, 10)
 */
export async function reverseNominatim(
  lat: number,
  lon: number,
  zoom = 10,
): Promise<NominatimResult | null> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    zoom: zoom.toString(),
    format: "jsonv2",
    addressdetails: "1",
    extratags: "1",
    namedetails: "1",
  });

  const url = `${NOMINATIM_BASE_URL}/reverse?${params.toString()}`;

  try {
    const response = await nominatimFetch(url);
    const data = (await response.json()) as NominatimResult & {
      error?: string;
    };

    // Reverse geocoding returns a single result or an error object
    if (data.error) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Map Nominatim result to a location type string
 */
export function mapNominatimToLocationType(result: NominatimResult): string {
  const { type, category, place_rank } = result;

  // Country level
  if (type === "country" || place_rank <= 4) {
    return "country";
  }

  // Region level (state, region, province)
  if (
    type === "state" ||
    type === "region" ||
    type === "province" ||
    place_rank <= 8
  ) {
    return "region";
  }

  // Municipality level (city, town, municipality)
  if (
    type === "city" ||
    type === "town" ||
    type === "municipality" ||
    (category === "boundary" && place_rank >= 12 && place_rank <= 16)
  ) {
    return "municipality";
  }

  // Village/district level
  if (type === "village" || type === "suburb" || type === "neighbourhood") {
    return "village";
  }

  // Default to district for other admin boundaries
  if (category === "boundary" || category === "place") {
    return "district";
  }

  return "district";
}

/**
 * Map Nominatim result to admin_level
 * Based on OSM's admin_level values:
 * 2 = country, 4 = region/state, 6 = county, 7 = municipality, 8 = village/district
 */
export function mapNominatimToAdminLevel(
  result: NominatimResult,
): number | null {
  const { type, place_rank } = result;

  // Country level
  if (type === "country" || place_rank <= 4) {
    return 2;
  }

  // Region level
  if (
    type === "state" ||
    type === "region" ||
    type === "province" ||
    (place_rank > 4 && place_rank <= 8)
  ) {
    return 4;
  }

  // County level
  if (type === "county" || (place_rank > 8 && place_rank <= 12)) {
    return 6;
  }

  // Municipality level
  if (
    type === "city" ||
    type === "town" ||
    type === "municipality" ||
    (place_rank > 12 && place_rank <= 16)
  ) {
    return 7;
  }

  // Village/district level
  if (type === "village" || type === "suburb" || place_rank > 16) {
    return 8;
  }

  return null;
}

/**
 * Extract localized names from Nominatim result
 */
export function extractLocalizedNames(result: NominatimResult): {
  name: string;
  nameFi: string | null;
  nameSv: string | null;
  nameEn: string | null;
} {
  const namedetails = result.namedetails || {};
  const extratags = result.extratags || {};

  return {
    name: result.name || namedetails.name || "",
    nameFi: namedetails["name:fi"] || extratags["name:fi"] || null,
    nameSv: namedetails["name:sv"] || extratags["name:sv"] || null,
    nameEn: namedetails["name:en"] || extratags["name:en"] || null,
  };
}

/**
 * Extract bounding box from Nominatim result as GeoJSON-compatible format
 */
export function extractBounds(result: NominatimResult): {
  south: number;
  north: number;
  west: number;
  east: number;
} | null {
  if (!result.boundingbox || result.boundingbox.length !== 4) {
    return null;
  }

  return {
    south: parseFloat(result.boundingbox[0]),
    north: parseFloat(result.boundingbox[1]),
    west: parseFloat(result.boundingbox[2]),
    east: parseFloat(result.boundingbox[3]),
  };
}

/**
 * Extract population from Nominatim extratags
 */
export function extractPopulation(result: NominatimResult): number | null {
  const population = result.extratags?.population;
  if (population) {
    const parsed = parseInt(population, 10);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Normalize OSM type string to our standard format
 */
export function normalizeOsmType(osmType: string): OsmType {
  const typeMap: Record<string, OsmType> = {
    node: "node",
    way: "way",
    relation: "relation",
    N: "node",
    W: "way",
    R: "relation",
    n: "node",
    w: "way",
    r: "relation",
  };

  return typeMap[osmType] || "node";
}
