import { Router, type Response } from "express";
import { z } from "zod";
import {
  searchLocations,
  lookupLocation,
  getLocationHierarchy,
  type LocationResult,
} from "../services/locations.js";
import type { OsmType } from "../services/nominatim.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// Validation schemas
const searchSchema = z.object({
  q: z.string().min(1).max(100),
  country: z.string().length(2).optional().default("FI"),
  types: z.string().optional(), // Comma-separated: 'municipality,village,city'
  limit: z.coerce.number().min(1).max(20).optional().default(10),
  includeNominatim: z.coerce.boolean().optional().default(true),
});

const osmLookupSchema = z.object({
  osmType: z.enum(["node", "way", "relation"]),
  osmId: z.coerce.number().int().positive(),
});

/**
 * GET /locations/search
 *
 * Hybrid search: DB + Nominatim
 *
 * Query params:
 * - q: Search term (required)
 * - country: ISO 3166-1 alpha-2 code (default: FI)
 * - types: Comma-separated location types (municipality, village, city, region)
 * - limit: Max results (default: 10, max: 20)
 * - includeNominatim: Whether to search Nominatim if few local results (default: true)
 *
 * Response:
 * {
 *   results: LocationResult[],
 *   source: 'cache' | 'nominatim' | 'mixed'
 * }
 */
router.get(
  "/search",
  asyncHandler(async (req, res: Response) => {
    const params = searchSchema.parse(req.query);

    const types = params.types
      ? params.types.split(",").map((t) => t.trim().toLowerCase())
      : undefined;

    const result = await searchLocations(params.q, {
      country: params.country,
      types,
      limit: params.limit,
      includeNominatim: params.includeNominatim,
    });

    res.json({
      success: true,
      data: {
        results: result.results.map(formatLocationResult),
        source: result.source,
      },
    });
  }),
);

/**
 * GET /locations/osm/:osmType/:osmId
 *
 * Look up a specific location by OSM type and ID.
 * Returns from DB if exists, otherwise fetches from Nominatim.
 *
 * Params:
 * - osmType: 'node', 'way', or 'relation'
 * - osmId: OSM ID number
 *
 * Response:
 * LocationResult with hierarchy
 */
router.get(
  "/osm/:osmType/:osmId",
  asyncHandler(async (req, res: Response) => {
    const params = osmLookupSchema.parse({
      osmType: req.params.osmType,
      osmId: req.params.osmId,
    });

    const location = await lookupLocation(
      params.osmType as OsmType,
      params.osmId,
    );

    if (!location) {
      res.status(404).json({
        success: false,
        error: "Location not found",
      });
      return;
    }

    // Get hierarchy if location is in DB
    let hierarchy: { name: string; type: string; adminLevel: number | null }[] =
      [];
    if (location.id) {
      hierarchy = await getLocationHierarchy(location.id);
    }

    res.json({
      success: true,
      data: {
        ...formatLocationResult(location),
        hierarchy,
      },
    });
  }),
);

/**
 * GET /locations/:id
 *
 * Get a location by database ID.
 *
 * Params:
 * - id: Location UUID
 *
 * Response:
 * LocationResult with hierarchy
 */
router.get(
  "/:id",
  asyncHandler(async (req, res: Response) => {
    const { id } = req.params;

    // Validate UUID format
    const uuidSchema = z.string().uuid();
    const validatedId = uuidSchema.parse(id);

    // Import here to avoid circular dependency
    const { findLocationById } = await import("../services/locations.js");
    const location = await findLocationById(validatedId);

    if (!location) {
      res.status(404).json({
        success: false,
        error: "Location not found",
      });
      return;
    }

    // Get hierarchy and parent for display name
    const hierarchy = await getLocationHierarchy(location.id);
    const parentLoc = location.parentId
      ? await findLocationById(location.parentId)
      : null;

    // Build display name: "Location, Parent, Country"
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
    const displayParts = [location.name];
    if (parentLoc) displayParts.push(parentLoc.name);
    if (location.country)
      displayParts.push(COUNTRY_NAMES[location.country] || location.country);

    // Format response
    const result: LocationResult = {
      id: location.id,
      osmId: location.osmId || 0,
      osmType: (location.osmType as OsmType) || "relation",
      name: location.name,
      nameFi: location.nameFi || null,
      nameSv: location.nameSv || null,
      nameEn: location.nameEn || null,
      displayName: displayParts.join(", "),
      type: location.type || "municipality",
      adminLevel: location.adminLevel,
      country: location.country || "FI",
      latitude: parseFloat(location.latitude?.toString() || "0"),
      longitude: parseFloat(location.longitude?.toString() || "0"),
      bounds: location.bounds as {
        south: number;
        north: number;
        west: number;
        east: number;
      } | null,
      population: location.population || null,
      status: "active",
      contentCount: location.contentCount || 0,
      parent: parentLoc
        ? { name: parentLoc.name, type: parentLoc.type || "region" }
        : null,
    };

    res.json({
      success: true,
      data: {
        ...formatLocationResult(result),
        hierarchy,
      },
    });
  }),
);

/**
 * Format LocationResult for API response
 */
function formatLocationResult(location: LocationResult) {
  return {
    id: location.id,
    osmId: location.osmId,
    osmType: location.osmType,
    name: location.name,
    nameFi: location.nameFi,
    nameSv: location.nameSv,
    nameEn: location.nameEn,
    displayName: location.displayName,
    type: location.type,
    adminLevel: location.adminLevel,
    country: location.country,
    latitude: location.latitude,
    longitude: location.longitude,
    bounds: location.bounds,
    population: location.population,
    status: location.status,
    contentCount: location.contentCount,
    parent: location.parent,
  };
}

export default router;
