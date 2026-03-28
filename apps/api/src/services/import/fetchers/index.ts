/**
 * Fetcher Registry
 *
 * Central registry of all minute fetchers and combined source list.
 * To add a new system, create a fetcher file implementing MinuteFetcher,
 * add its sources here, and register the fetcher.
 *
 * The adaptive fetcher handles all DB-configured sources (scraper_configs).
 * Static sources (CLOUDNC_SOURCES etc.) are kept for backward compatibility.
 */

export type { MinuteFetcher, MinuteSource, Meeting } from './types.js'

import type { MinuteFetcher, MinuteSource } from './types.js'
import { cloudncFetcher, CLOUDNC_SOURCES } from './cloudnc.js'
import { dynastyFetcher, DYNASTY_SOURCES } from './dynasty.js'
import { twebFetcher, TWEB_SOURCES } from './tweb.js'
import { adaptiveFetcher, loadAdaptiveSourcesFromDb } from '../adaptive/index.js'

// Fetcher registry: type string → fetcher implementation
export const fetchers: Record<string, MinuteFetcher> = {
  cloudnc: cloudncFetcher,
  dynasty: dynastyFetcher,
  tweb: twebFetcher,
  adaptive: adaptiveFetcher,
}

// Static sources (backward compatibility)
export const STATIC_SOURCES: MinuteSource[] = [
  ...CLOUDNC_SOURCES,
  ...DYNASTY_SOURCES,
  ...TWEB_SOURCES,
]

// Legacy export for backward compatibility
export const MINUTE_SOURCES: MinuteSource[] = STATIC_SOURCES

/**
 * Get all minute sources: static (hand-coded) + adaptive (DB-configured).
 * Use this instead of MINUTE_SOURCES for the full set of sources.
 */
export async function getMinuteSources(): Promise<MinuteSource[]> {
  try {
    const adaptiveSources = await loadAdaptiveSourcesFromDb()
    return [...STATIC_SOURCES, ...adaptiveSources]
  } catch (err) {
    // If scraper DB is not available, fall back to static sources only
    console.log(`   [fetchers] Could not load adaptive sources: ${err instanceof Error ? err.message : err}`)
    return STATIC_SOURCES
  }
}
