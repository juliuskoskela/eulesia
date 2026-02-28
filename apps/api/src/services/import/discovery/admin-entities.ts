/**
 * Administrative Level Types for Multi-Level Governance Scraping
 *
 * Extends the municipality-only scraper to support higher administrative levels:
 * - municipality: City/town/village councils (kunnat, kommuner, Gemeinden, kommuner, omavalitsused)
 * - county: County-level governance (fylkeskommune NO, Landkreis DE)
 * - region: Regional governance (maakuntaliitto FI, region SE/DK, département FR)
 * - state: State/federal state governance (Bundesland DE)
 *
 * These map to OSM admin_levels approximately:
 * - state:        admin_level 4 (DE Bundesland, US State)
 * - region:       admin_level 4-6 (FI maakunta, SE region, DK region, FR région)
 * - county:       admin_level 5-7 (NO fylke, DE Landkreis, FR département)
 * - municipality:  admin_level 7-8 (all countries)
 */

export type AdminLevel = 'municipality' | 'county' | 'region' | 'state'

/**
 * An administrative entity at any governance level.
 * Extends the simple { name, slug, population } pattern used for municipalities.
 */
export interface AdminEntity {
  /** Display name in local language (e.g., "Pirkanmaan liitto", "Region Stockholm") */
  name: string
  /** URL-safe slug following country-specific conventions */
  slug: string
  /** Administrative level */
  adminLevel: AdminLevel
  /** Approximate population (for prioritization) */
  population?: number
  /** Parent entity name for hierarchy (e.g., county's parent is a state in DE) */
  parent?: string
  /** ISO 3166-2 subdivision code if applicable (e.g., "FI-11" for Pirkanmaa) */
  subdivisionCode?: string
}

/**
 * Country-specific admin level metadata.
 * Describes what each admin level means in a given country's governance structure.
 */
export interface AdminLevelMeta {
  level: AdminLevel
  /** Local name for this level (e.g., "maakuntaliitto", "fylkeskommune", "Bundesland") */
  localName: string
  /** English name */
  englishName: string
  /** How many entities at this level */
  count: number
  /** What kind of decisions are made at this level */
  scope?: string
}

/**
 * Admin level metadata per country.
 * Documents the governance structure for each priority country.
 */
export const ADMIN_LEVEL_META: Record<string, AdminLevelMeta[]> = {
  FI: [
    {
      level: 'region',
      localName: 'maakuntaliitto',
      englishName: 'Regional council',
      count: 19,
      scope: 'Regional planning, land use, EU structural funds, regional transport',
    },
  ],
  SE: [
    {
      level: 'region',
      localName: 'region',
      englishName: 'Region',
      count: 21,
      scope: 'Healthcare, public transport, regional development, culture',
    },
  ],
  NO: [
    {
      level: 'county',
      localName: 'fylkeskommune',
      englishName: 'County municipality',
      count: 15,
      scope: 'Upper secondary education, regional transport, dental care, cultural heritage',
    },
  ],
  DK: [
    {
      level: 'region',
      localName: 'region',
      englishName: 'Region',
      count: 5,
      scope: 'Hospitals, healthcare, regional development, soil contamination',
    },
  ],
  DE: [
    {
      level: 'state',
      localName: 'Bundesland',
      englishName: 'Federal state',
      count: 16,
      scope: 'Education, police, healthcare, culture, justice — major legislative power',
    },
  ],
}
