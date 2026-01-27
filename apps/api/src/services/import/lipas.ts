/**
 * Lipas Import Service
 *
 * Imports sports facilities and outdoor routes from Lipas
 * (Finnish national sports facility database).
 *
 * API Documentation: https://lipas.fi/api-docs
 */

import { db, places } from '../../db/index.js'
import { eq } from 'drizzle-orm'

const LIPAS_API = 'https://api.lipas.fi/v2'

// Lipas API v2 response structure
interface LipasPlace {
  'lipas-id': number
  name: string
  status: string
  type: {
    'type-code': string
  }
  location: {
    city?: {
      'city-code': string
    }
    address?: string
    'postal-code'?: string
    'postal-office'?: string
    geometries?: {
      type: 'FeatureCollection'
      features: Array<{
        geometry: {
          type: string
          coordinates: number[]
        }
      }>
    }
  }
  properties?: Record<string, unknown>
  www?: string
  email?: string
  'phone-number'?: string
  'construction-year'?: number
  owner?: string
  admin?: string
}

// Lipas type codes to Eulesia category mapping
const TYPE_MAPPING: Record<number, { type: string; category: string; subcategory: string }> = {
  // Swimming
  3110: { type: 'poi', category: 'recreation', subcategory: 'swimming_hall' },
  3120: { type: 'poi', category: 'recreation', subcategory: 'swimming_outdoor' },
  3130: { type: 'poi', category: 'recreation', subcategory: 'beach' },

  // Ball sports
  1310: { type: 'area', category: 'recreation', subcategory: 'football_field' },
  1320: { type: 'area', category: 'recreation', subcategory: 'sports_field' },
  1330: { type: 'poi', category: 'recreation', subcategory: 'tennis_court' },
  1340: { type: 'poi', category: 'recreation', subcategory: 'basketball_court' },
  1350: { type: 'poi', category: 'recreation', subcategory: 'volleyball_court' },
  1380: { type: 'poi', category: 'recreation', subcategory: 'padel_court' },

  // Indoor sports
  2110: { type: 'building', category: 'recreation', subcategory: 'sports_hall' },
  2120: { type: 'building', category: 'recreation', subcategory: 'gym' },
  2150: { type: 'building', category: 'recreation', subcategory: 'climbing_hall' },

  // Ice sports
  4110: { type: 'poi', category: 'recreation', subcategory: 'ice_rink' },
  4120: { type: 'poi', category: 'recreation', subcategory: 'ice_hall' },
  4210: { type: 'route', category: 'recreation', subcategory: 'ski_track' },
  4220: { type: 'area', category: 'recreation', subcategory: 'ski_slope' },

  // Outdoor routes
  4401: { type: 'route', category: 'nature', subcategory: 'hiking_trail' },
  4402: { type: 'route', category: 'nature', subcategory: 'nature_trail' },
  4403: { type: 'route', category: 'nature', subcategory: 'cycling_route' },
  4404: { type: 'route', category: 'nature', subcategory: 'skiing_route' },
  4405: { type: 'route', category: 'nature', subcategory: 'jogging_track' },

  // Outdoor recreation
  4510: { type: 'poi', category: 'recreation', subcategory: 'disc_golf' },
  4520: { type: 'poi', category: 'recreation', subcategory: 'skateboard_park' },
  4610: { type: 'poi', category: 'recreation', subcategory: 'outdoor_gym' },
  4620: { type: 'area', category: 'recreation', subcategory: 'playground' },

  // Water sports
  5110: { type: 'poi', category: 'recreation', subcategory: 'boat_launch' },
  5120: { type: 'poi', category: 'recreation', subcategory: 'marina' },

  // Golf
  6110: { type: 'area', category: 'recreation', subcategory: 'golf_course' },

  // Shooting & archery
  7110: { type: 'poi', category: 'recreation', subcategory: 'shooting_range' },
  7210: { type: 'poi', category: 'recreation', subcategory: 'archery_range' },
}

// Default mapping for unknown types
const DEFAULT_MAPPING = { type: 'poi', category: 'recreation', subcategory: 'sports_facility' }

export interface LipasImportOptions {
  typeCodes?: number[]
  municipalityCodes?: number[]
  dryRun?: boolean
  batchSize?: number
  limit?: number
}

export interface ImportResult {
  imported: number
  updated: number
  skipped: number
  errors: string[]
}

/**
 * Fetch sports places from Lipas API v2
 * API docs: https://api.lipas.fi/
 */
async function fetchLipasPlaces(options: {
  typeCodes?: number[]
  municipalityCodes?: number[]
  limit?: number
}): Promise<LipasPlace[]> {
  const allPlaces: LipasPlace[] = []
  const pageSize = 100 // Max allowed by API
  let page = 1
  let hasMore = true
  const maxPages = options.limit ? Math.ceil(options.limit / pageSize) : 600 // Safety limit (~56k places)
  let consecutiveErrors = 0
  const maxConsecutiveErrors = 3

  while (hasMore && page <= maxPages) {
    const params = new URLSearchParams()
    params.set('page', page.toString())
    params.set('page-size', pageSize.toString())

    if (options.typeCodes?.length) {
      options.typeCodes.forEach(code => params.append('type-codes', code.toString()))
    }

    if (options.municipalityCodes?.length) {
      options.municipalityCodes.forEach(code => params.append('city-codes', code.toString()))
    }

    const url = `${LIPAS_API}/sports-sites?${params.toString()}`

    if (page === 1 || page % 10 === 0) {
      console.log(`   Fetching page ${page}: ${url}`)
    }

    try {
      const response = await fetch(url)

      if (!response.ok) {
        consecutiveErrors++
        console.log(`   ⚠️  Page ${page} failed: ${response.status} (attempt ${consecutiveErrors}/${maxConsecutiveErrors})`)

        if (consecutiveErrors >= maxConsecutiveErrors) {
          console.log(`   ❌ Too many consecutive errors, stopping at page ${page}`)
          hasMore = false
        } else {
          // Wait longer before retry
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        continue
      }

      consecutiveErrors = 0 // Reset on success
      const data = await response.json() as { items: LipasPlace[]; pagination?: { 'total-items'?: number } }

      if (data.items && data.items.length > 0) {
        allPlaces.push(...data.items)
        page++

        // Check if we've fetched all
        if (data.items.length < pageSize) {
          hasMore = false
        }
        if (options.limit && allPlaces.length >= options.limit) {
          hasMore = false
        }
      } else {
        hasMore = false
      }
    } catch (err) {
      consecutiveErrors++
      console.log(`   ⚠️  Page ${page} error: ${err} (attempt ${consecutiveErrors}/${maxConsecutiveErrors})`)

      if (consecutiveErrors >= maxConsecutiveErrors) {
        console.log(`   ❌ Too many consecutive errors, stopping at page ${page}`)
        hasMore = false
      } else {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      continue
    }

    // Rate limit - be nice to the API
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return allPlaces
}

/**
 * Parse Lipas place to Eulesia format
 */
function parseLipasPlace(place: LipasPlace): {
  name: string
  nameFi?: string
  nameSv?: string
  nameEn?: string
  latitude: number
  longitude: number
  sourceId: string
  type: string
  category: string
  subcategory: string
  address?: string
  postalCode?: string
  city?: string
  phone?: string
  email?: string
  website?: string
  metadata: object
} | null {
  // Get coordinates from location.geometries
  const feature = place.location?.geometries?.features?.[0]
  const coords = feature?.geometry?.coordinates
  if (!coords || coords.length < 2) return null

  // Coordinates are [lon, lat] in GeoJSON
  const lon = coords[0]
  const lat = coords[1]

  if (!lat || !lon || isNaN(lat) || isNaN(lon)) return null

  // Get name
  const name = place.name
  if (!name) return null

  // Get category mapping - type-code is a string in the API
  const typeCode = parseInt(place.type?.['type-code'] || '0', 10)
  const mapping = typeCode ? (TYPE_MAPPING[typeCode] || DEFAULT_MAPPING) : DEFAULT_MAPPING

  return {
    name,
    nameFi: place.name,
    latitude: lat,
    longitude: lon,
    sourceId: `lipas-${place['lipas-id']}`,
    type: mapping.type,
    category: mapping.category,
    subcategory: mapping.subcategory,
    address: place.location?.address,
    postalCode: place.location?.['postal-code'],
    city: place.location?.['postal-office'],
    phone: place['phone-number'],
    email: place.email,
    website: place.www,
    metadata: {
      lipasId: place['lipas-id'],
      typeCode: typeCode,
      status: place.status,
      cityCode: place.location?.city?.['city-code'],
      properties: place.properties,
      constructionYear: place['construction-year'],
      owner: place.owner,
      admin: place.admin,
      importedAt: new Date().toISOString()
    }
  }
}

/**
 * Import sports facilities from Lipas
 */
export async function importFromLipas(options: LipasImportOptions = {}): Promise<ImportResult> {
  const {
    typeCodes,
    municipalityCodes,
    dryRun = false,
    batchSize = 100,
    limit
  } = options

  console.log(`🏃 Starting Lipas import...`)
  console.log(`   Type codes: ${typeCodes?.join(', ') || 'all'}`)
  console.log(`   Municipality codes: ${municipalityCodes?.join(', ') || 'all'}`)
  console.log(`   Dry run: ${dryRun}`)

  const result: ImportResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: []
  }

  try {
    // Fetch places from Lipas
    console.log(`   Starting fetch...`)
    const lipasPlaces = await fetchLipasPlaces({ typeCodes, municipalityCodes, limit })
    console.log(`   Fetched ${lipasPlaces.length} places from Lipas`)

    // Debug: show first item structure
    if (lipasPlaces.length > 0) {
      console.log(`   Sample item:`, JSON.stringify(lipasPlaces[0], null, 2).slice(0, 500))
    }

    // Parse and filter valid places
    const parsedPlaces = lipasPlaces
      .map(parseLipasPlace)
      .filter((p): p is NonNullable<typeof p> => p !== null)

    console.log(`   Parsed ${parsedPlaces.length} valid places`)

    if (dryRun) {
      result.imported = parsedPlaces.length
      console.log(`✅ Lipas import complete (dry run):`)
      console.log(`   Would import: ${result.imported}`)
      return result
    }

    // Upsert places in batches
    for (let i = 0; i < parsedPlaces.length; i += batchSize) {
      const batch = parsedPlaces.slice(i, i + batchSize)

      for (const place of batch) {
        try {
          // Check if place already exists by source ID
          const existing = await db
            .select({ id: places.id })
            .from(places)
            .where(eq(places.sourceId, place.sourceId))
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
                country: 'FI',
                address: place.address,
                postalCode: place.postalCode,
                city: place.city,
                phone: place.phone,
                email: place.email,
                website: place.website,
                source: 'lipas',
                sourceId: place.sourceId,
                sourceUrl: `https://lipas.fi/liikuntapaikka/${(place.metadata as { lipasId: number }).lipasId}`,
                lastSynced: new Date(),
                metadata: place.metadata
              })

            result.imported++
          }
        } catch (err) {
          result.errors.push(`Failed to upsert ${place.sourceId}: ${err}`)
          result.skipped++
        }
      }

      console.log(`   Processed ${Math.min(i + batchSize, parsedPlaces.length)}/${parsedPlaces.length}`)
    }

  } catch (err) {
    result.errors.push(`Import error: ${err}`)
  }

  console.log(`✅ Lipas import complete:`)
  console.log(`   Imported: ${result.imported}`)
  console.log(`   Updated: ${result.updated}`)
  console.log(`   Skipped: ${result.skipped}`)
  console.log(`   Errors: ${result.errors.length}`)

  return result
}

/**
 * Get available Lipas type codes
 */
export function getAvailableTypeCodes(): { code: number; name: string }[] {
  return Object.entries(TYPE_MAPPING).map(([code, mapping]) => ({
    code: parseInt(code),
    name: mapping.subcategory.replace(/_/g, ' ')
  }))
}
