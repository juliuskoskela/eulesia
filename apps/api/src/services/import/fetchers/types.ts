/**
 * Shared interfaces for minute fetchers
 *
 * Each system (CloudNC, Dynasty, Tweb, ALLRIS, etc.) implements the MinuteFetcher
 * interface to provide a uniform way to fetch and extract meeting minutes.
 *
 * Sources can be municipalities, counties, regions, or federal states —
 * any administrative entity that publishes meeting protocols.
 */

import type { AdminLevel } from '../discovery/admin-entities.js'

export interface Meeting {
  id: string
  pageUrl: string
  title: string
  date?: string
  organ?: string  // e.g., "Kunnanhallitus", "Valtuusto", "Landtag", "Regionsråd"
}

export interface MinuteSource {
  municipality: string              // Entity name — kept as 'municipality' for backward compat with all existing code
  entityName?: string               // Generic alias: same as municipality but explicit for non-municipal sources
  adminLevel?: AdminLevel           // 'municipality' | 'county' | 'region' | 'state'. Default: 'municipality'
  type: string                      // 'cloudnc' | 'dynasty' | 'tweb' | 'adaptive'
  url: string
  country?: string                  // ISO 3166-1 alpha-2: 'FI' | 'EE' | 'DE' | 'SE' | 'FR' etc. Default: 'FI'
  language?: string                 // Content language: 'fi' | 'et' | 'de' | 'sv' | 'fr' etc. Default: 'fi'
  region?: string                   // For welfare regions (hyvinvointialueet)
  pdfBasePath?: string              // Override default PDF path
  pathPrefix?: string               // e.g., '/D10_Haapajarvi' for Dynasty variations
  configId?: string                 // Reference to scraper_configs table (for adaptive sources)
}

/**
 * Get the effective entity name from a source.
 * Prefers entityName if set, falls back to municipality.
 */
export function getEntityName(source: MinuteSource): string {
  return source.entityName || source.municipality
}

/**
 * Get the effective admin level from a source.
 * Defaults to 'municipality' if not explicitly set.
 */
export function getAdminLevel(source: MinuteSource): AdminLevel {
  return source.adminLevel || 'municipality'
}

export interface MinuteFetcher {
  type: string
  fetchMeetings(source: MinuteSource): Promise<Meeting[]>
  extractContent(meeting: Meeting, source: MinuteSource): Promise<string | null>
}
