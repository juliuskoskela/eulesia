/**
 * Search API Routes
 *
 * Federated search across users, threads, places, municipalities, and tags.
 */

import { Router, type Response } from "express";
import { z } from "zod";
import {
  search,
  searchUsers,
  searchThreads,
  searchPlaces,
  healthCheck,
} from "../services/search/index.js";
import { searchLocations } from "../services/locations.js";
import { optionalAuthMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AuthenticatedRequest } from "../types/index.js";

const router = Router();

// Validation schemas
const searchSchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().min(1).max(20).default(5),
});

const threadSearchSchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().min(1).max(50).default(20),
  scope: z.enum(["local", "national", "european"]).optional(),
  municipalityId: z.string().uuid().optional(),
  tags: z.string().optional(), // Comma-separated
});

/**
 * GET /search - Federated search across all indexes
 *
 * Returns users, threads, places, municipalities, and tags matching the query.
 * Results are typo-tolerant and ranked by relevance.
 */
router.get(
  "/",
  optionalAuthMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { q, limit } = searchSchema.parse(req.query);

    // Check if search is available
    const isHealthy = await healthCheck();
    if (!isHealthy) {
      res.status(503).json({
        success: false,
        error: "Search service temporarily unavailable",
      });
      return;
    }

    const results = await search(q, {
      limit,
      userId: req.user?.id,
    });

    // If few location/municipality results from Meilisearch, supplement with Nominatim
    const totalLocationResults =
      results.locations.length + results.municipalities.length;
    if (totalLocationResults < 3) {
      try {
        const { results: nominatimResults } = await searchLocations(q, {
          limit: 5,
          includeNominatim: true,
        });
        // Add Nominatim results that aren't already in locations
        const existingOsmIds = new Set(results.locations.map((l) => l.osmId));
        for (const loc of nominatimResults) {
          if (!existingOsmIds.has(loc.osmId)) {
            results.locations.push({
              id: loc.id || `nom-${loc.osmId}`,
              osmId: loc.osmId,
              osmType: loc.osmType,
              name: loc.name,
              nameFi: loc.nameFi || undefined,
              displayName: loc.displayName,
              type: loc.type,
              country: loc.country,
              latitude: loc.latitude,
              longitude: loc.longitude,
              contentCount: loc.contentCount,
              parentName: loc.parent?.name,
            });
            existingOsmIds.add(loc.osmId);
          }
        }
      } catch {
        // Don't fail the whole search if Nominatim is down
      }
    }

    res.json({
      success: true,
      data: results,
    });
  }),
);

/**
 * GET /search/users - Search only users
 */
router.get(
  "/users",
  asyncHandler(async (req, res: Response) => {
    const { q, limit } = searchSchema.parse(req.query);

    const isHealthy = await healthCheck();
    if (!isHealthy) {
      res.status(503).json({
        success: false,
        error: "Search service temporarily unavailable",
      });
      return;
    }

    const users = await searchUsers(q, limit);

    res.json({
      success: true,
      data: users,
    });
  }),
);

/**
 * GET /search/threads - Search only threads
 */
router.get(
  "/threads",
  asyncHandler(async (req, res: Response) => {
    const params = threadSearchSchema.parse(req.query);

    const isHealthy = await healthCheck();
    if (!isHealthy) {
      res.status(503).json({
        success: false,
        error: "Search service temporarily unavailable",
      });
      return;
    }

    const threads = await searchThreads(params.q, {
      limit: params.limit,
      scope: params.scope,
      municipalityId: params.municipalityId,
      tags: params.tags?.split(",").map((t) => t.trim()),
    });

    res.json({
      success: true,
      data: threads,
    });
  }),
);

/**
 * GET /search/places - Search only places
 */
router.get(
  "/places",
  asyncHandler(async (req, res: Response) => {
    const { q, limit } = searchSchema.parse(req.query);

    const isHealthy = await healthCheck();
    if (!isHealthy) {
      res.status(503).json({
        success: false,
        error: "Search service temporarily unavailable",
      });
      return;
    }

    const places = await searchPlaces(q, limit);

    res.json({
      success: true,
      data: places,
    });
  }),
);

/**
 * GET /search/health - Check search service health
 */
router.get(
  "/health",
  asyncHandler(async (_req, res: Response) => {
    const isHealthy = await healthCheck();

    res.json({
      success: true,
      data: {
        status: isHealthy ? "available" : "unavailable",
      },
    });
  }),
);

export default router;
