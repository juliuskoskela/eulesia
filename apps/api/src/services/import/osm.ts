/**
 * OpenStreetMap Import Service
 *
 * Imports places from OpenStreetMap via Overpass API.
 * Supports filtering by country, region, and category.
 */

import { db, places } from '../../db/index.js'
import { eq } from 'drizzle-orm'

const OVERPASS_API = 'https://overpass-api.de/api/interpreter'

// Rate limiting: max 2 requests per second
const RATE_LIMIT_MS = 500
let lastRequestTime = 0

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

interface OverpassResponse {
  elements: OverpassElement[]
}

// OSM tag to Eulesia category mapping
const CATEGORY_MAPPING: Record<string, { type: string; category: string; subcategory?: string }> = {
  // Civic
  'amenity=library': { type: 'poi', category: 'civic', subcategory: 'library' },
  'amenity=townhall': { type: 'poi', category: 'civic', subcategory: 'municipality_office' },
  'amenity=community_centre': { type: 'poi', category: 'civic', subcategory: 'community_center' },
  'amenity=school': { type: 'building', category: 'civic', subcategory: 'school' },
  'amenity=university': { type: 'building', category: 'civic', subcategory: 'university' },
  'amenity=hospital': { type: 'building', category: 'civic', subcategory: 'healthcare' },
  'amenity=clinic': { type: 'poi', category: 'civic', subcategory: 'healthcare' },
  'amenity=police': { type: 'poi', category: 'civic', subcategory: 'emergency_services' },
  'amenity=fire_station': { type: 'poi', category: 'civic', subcategory: 'emergency_services' },

  // Recreation
  'leisure=park': { type: 'area', category: 'recreation', subcategory: 'park' },
  'leisure=playground': { type: 'poi', category: 'recreation', subcategory: 'playground' },
  'leisure=sports_centre': { type: 'poi', category: 'recreation', subcategory: 'sports_center' },
  'leisure=swimming_pool': { type: 'poi', category: 'recreation', subcategory: 'swimming' },
  'leisure=stadium': { type: 'poi', category: 'recreation', subcategory: 'stadium' },
  'leisure=pitch': { type: 'area', category: 'recreation', subcategory: 'sports_field' },
  'leisure=beach_resort': { type: 'area', category: 'recreation', subcategory: 'beach' },
  'natural=beach': { type: 'area', category: 'recreation', subcategory: 'beach' },

  // Nature
  'boundary=national_park': { type: 'area', category: 'nature', subcategory: 'national_park' },
  'leisure=nature_reserve': { type: 'area', category: 'nature', subcategory: 'nature_reserve' },
  'natural=water': { type: 'area', category: 'nature', subcategory: 'lake' },
  'route=hiking': { type: 'route', category: 'nature', subcategory: 'hiking_trail' },
  'route=bicycle': { type: 'route', category: 'nature', subcategory: 'cycling_route' },

  // Culture
  'tourism=museum': { type: 'poi', category: 'culture', subcategory: 'museum' },
  'amenity=theatre': { type: 'poi', category: 'culture', subcategory: 'theater' },
  'amenity=cinema': { type: 'poi', category: 'culture', subcategory: 'cinema' },
  'tourism=gallery': { type: 'poi', category: 'culture', subcategory: 'gallery' },
  'historic=monument': { type: 'landmark', category: 'culture', subcategory: 'heritage_site' },
  'historic=castle': { type: 'landmark', category: 'culture', subcategory: 'heritage_site' },
  'historic=church': { type: 'landmark', category: 'culture', subcategory: 'heritage_site' },

  // Transport
  'public_transport=station': { type: 'poi', category: 'transport', subcategory: 'train_station' },
  'railway=station': { type: 'poi', category: 'transport', subcategory: 'train_station' },
  'amenity=bus_station': { type: 'poi', category: 'transport', subcategory: 'bus_station' },
  'aeroway=aerodrome': { type: 'poi', category: 'transport', subcategory: 'airport' },
  'amenity=ferry_terminal': { type: 'poi', category: 'transport', subcategory: 'ferry_terminal' },

  // Landmarks
  'tourism=viewpoint': { type: 'landmark', category: 'landmark', subcategory: 'viewpoint' },
  'man_made=tower': { type: 'landmark', category: 'landmark', subcategory: 'tower' },
  'tourism=attraction': { type: 'poi', category: 'landmark', subcategory: 'attraction' },
}

// Country codes and their Overpass area IDs
const COUNTRY_AREAS: Record<string, string> = {
  FI: 'area["ISO3166-1"="FI"]',
  SE: 'area["ISO3166-1"="SE"]',
  NO: 'area["ISO3166-1"="NO"]',
  DK: 'area["ISO3166-1"="DK"]',
  EE: 'area["ISO3166-1"="EE"]',
  LV: 'area["ISO3166-1"="LV"]',
  LT: 'area["ISO3166-1"="LT"]',
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime

  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - timeSinceLastRequest)
  }

  lastRequestTime = Date.now()
  return fetch(url, options)
}

function buildOverpassQuery(country: string, categories: string[]): string {
  const areaSelector = COUNTRY_AREAS[country] || COUNTRY_AREAS.FI

  // Build tag filters from categories
  const tagFilters = categories.flatMap(cat => {
    const [key, value] = cat.split('=')
    return [
      `node["${key}"="${value}"](area.searchArea);`,
      `way["${key}"="${value}"](area.searchArea);`,
      `relation["${key}"="${value}"](area.searchArea);`
    ]
  })

  return `
[out:json][timeout:180];
${areaSelector}->.searchArea;
(
  ${tagFilters.join('\n  ')}
);
out center tags;
`.trim()
}

function parseOsmElement(element: OverpassElement): {
  name: string
  nameFi?: string
  nameSv?: string
  nameEn?: string
  latitude: number
  longitude: number
  osmId: string
  type: string
  category: string
  subcategory?: string
  address?: string
  postalCode?: string
  city?: string
  phone?: string
  email?: string
  website?: string
  openingHours?: object
  metadata: object
} | null {
  const tags = element.tags || {}

  // Get coordinates
  const lat = element.lat ?? element.center?.lat
  const lon = element.lon ?? element.center?.lon

  if (!lat || !lon) return null

  // Get name (skip unnamed places)
  const name = tags.name || tags['name:fi'] || tags['name:en']
  if (!name) return null

  // Determine category from tags
  let matchedCategory: { type: string; category: string; subcategory?: string } | null = null

  for (const [tagPattern, categoryInfo] of Object.entries(CATEGORY_MAPPING)) {
    const [key, value] = tagPattern.split('=')
    if (tags[key] === value) {
      matchedCategory = categoryInfo
      break
    }
  }

  if (!matchedCategory) return null

  // Parse opening hours if present
  let openingHours: object | undefined
  if (tags.opening_hours) {
    openingHours = { raw: tags.opening_hours }
  }

  return {
    name,
    nameFi: tags['name:fi'],
    nameSv: tags['name:sv'],
    nameEn: tags['name:en'],
    latitude: lat,
    longitude: lon,
    osmId: `${element.type}/${element.id}`,
    type: matchedCategory.type,
    category: matchedCategory.category,
    subcategory: matchedCategory.subcategory,
    address: [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ') || undefined,
    postalCode: tags['addr:postcode'],
    city: tags['addr:city'],
    phone: tags.phone || tags['contact:phone'],
    email: tags.email || tags['contact:email'],
    website: tags.website || tags['contact:website'],
    openingHours,
    metadata: {
      osmTags: tags,
      importedAt: new Date().toISOString()
    }
  }
}

export interface ImportOptions {
  country?: string
  categories?: string[]
  dryRun?: boolean
  batchSize?: number
}

export interface ImportResult {
  imported: number
  updated: number
  skipped: number
  errors: string[]
}

/**
 * Import places from OpenStreetMap for a given country
 */
export async function importFromOSM(options: ImportOptions = {}): Promise<ImportResult> {
  const {
    country = 'FI',
    categories = Object.keys(CATEGORY_MAPPING),
    dryRun = false,
    batchSize = 100
  } = options

  console.log(`🗺️  Starting OSM import for ${country}...`)
  console.log(`   Categories: ${categories.length}`)
  console.log(`   Dry run: ${dryRun}`)

  const result: ImportResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: []
  }

  // Process categories in batches to avoid timeout
  const categoryBatches: string[][] = []
  for (let i = 0; i < categories.length; i += 5) {
    categoryBatches.push(categories.slice(i, i + 5))
  }

  for (const categoryBatch of categoryBatches) {
    try {
      console.log(`   Fetching: ${categoryBatch.join(', ')}`)

      const query = buildOverpassQuery(country, categoryBatch)

      const response = await rateLimitedFetch(OVERPASS_API, {
        method: 'POST',
        body: query,
        headers: {
          'Content-Type': 'text/plain'
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        result.errors.push(`Overpass API error: ${response.status} - ${errorText.slice(0, 200)}`)
        continue
      }

      const data = await response.json() as OverpassResponse
      console.log(`   Found ${data.elements.length} elements`)

      // Process elements in batches
      const parsedPlaces = data.elements
        .map(parseOsmElement)
        .filter((p): p is NonNullable<typeof p> => p !== null)

      console.log(`   Parsed ${parsedPlaces.length} valid places`)

      if (dryRun) {
        result.imported += parsedPlaces.length
        continue
      }

      // Upsert places in batches
      for (let i = 0; i < parsedPlaces.length; i += batchSize) {
        const batch = parsedPlaces.slice(i, i + batchSize)

        for (const place of batch) {
          try {
            // Check if place already exists by OSM ID
            const existing = await db
              .select({ id: places.id })
              .from(places)
              .where(eq(places.osmId, place.osmId))
              .limit(1)

            if (existing.length > 0) {
              // Update existing
              await db
                .update(places)
                .set({
                  name: place.name,
                  nameFi: place.nameFi,
                  nameSv: place.nameSv,
                  nameEn: place.nameEn,
                  latitude: place.latitude.toString(),
                  longitude: place.longitude.toString(),
                  category: place.category,
                  subcategory: place.subcategory,
                  address: place.address,
                  postalCode: place.postalCode,
                  city: place.city,
                  phone: place.phone,
                  email: place.email,
                  website: place.website,
                  openingHours: place.openingHours,
                  metadata: place.metadata,
                  lastSynced: new Date(),
                  updatedAt: new Date()
                })
                .where(eq(places.id, existing[0].id))

              result.updated++
            } else {
              // Insert new
              await db
                .insert(places)
                .values({
                  name: place.name,
                  nameFi: place.nameFi,
                  nameSv: place.nameSv,
                  nameEn: place.nameEn,
                  latitude: place.latitude.toString(),
                  longitude: place.longitude.toString(),
                  type: place.type as 'poi' | 'area' | 'route' | 'landmark' | 'building',
                  category: place.category,
                  subcategory: place.subcategory,
                  country,
                  address: place.address,
                  postalCode: place.postalCode,
                  city: place.city,
                  phone: place.phone,
                  email: place.email,
                  website: place.website,
                  openingHours: place.openingHours,
                  source: 'osm',
                  sourceId: place.osmId,
                  osmId: place.osmId,
                  sourceUrl: `https://www.openstreetmap.org/${place.osmId}`,
                  lastSynced: new Date(),
                  metadata: place.metadata
                })

              result.imported++
            }
          } catch (err) {
            result.errors.push(`Failed to upsert ${place.osmId}: ${err}`)
            result.skipped++
          }
        }

        console.log(`   Processed ${Math.min(i + batchSize, parsedPlaces.length)}/${parsedPlaces.length}`)
      }

    } catch (err) {
      result.errors.push(`Batch error: ${err}`)
    }

    // Rate limit between batches
    await sleep(1000)
  }

  console.log(`✅ OSM import complete:`)
  console.log(`   Imported: ${result.imported}`)
  console.log(`   Updated: ${result.updated}`)
  console.log(`   Skipped: ${result.skipped}`)
  console.log(`   Errors: ${result.errors.length}`)

  return result
}

/**
 * Get available OSM categories for import
 */
export function getAvailableCategories(): string[] {
  return Object.keys(CATEGORY_MAPPING)
}

/**
 * Get supported countries for OSM import
 */
export function getSupportedCountries(): string[] {
  return Object.keys(COUNTRY_AREAS)
}
