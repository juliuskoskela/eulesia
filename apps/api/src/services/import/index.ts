/**
 * Geospatial Data Import Services
 *
 * Provides import pipelines for various data sources:
 * - OpenStreetMap (OSM) - Global POIs, buildings, parks, routes
 * - Lipas - Finnish sports facilities and outdoor routes
 * - (Future) MML - Finnish Land Survey data
 * - (Future) Municipal APIs - City-specific data
 */

export {
  importFromOSM,
  getAvailableCategories,
  getSupportedCountries,
  type ImportOptions as OSMImportOptions,
  type ImportResult
} from './osm.js'

export {
  importFromLipas,
  getAvailableTypeCodes,
  type LipasImportOptions
} from './lipas.js'

/**
 * Run all imports for a country
 */
export async function importAll(country: string = 'FI', dryRun: boolean = false) {
  const { importFromOSM } = await import('./osm.js')
  const { importFromLipas } = await import('./lipas.js')

  console.log(`\n🌍 Starting full import for ${country}...\n`)

  const results = {
    osm: { imported: 0, updated: 0, skipped: 0, errors: [] as string[] },
    lipas: { imported: 0, updated: 0, skipped: 0, errors: [] as string[] }
  }

  // OSM import
  console.log('─'.repeat(50))
  results.osm = await importFromOSM({ country, dryRun })

  // Lipas import (Finland only)
  if (country === 'FI') {
    console.log('\n' + '─'.repeat(50))
    results.lipas = await importFromLipas({ dryRun })
  }

  // Summary
  console.log('\n' + '═'.repeat(50))
  console.log('📊 IMPORT SUMMARY')
  console.log('═'.repeat(50))

  const totals = {
    imported: results.osm.imported + results.lipas.imported,
    updated: results.osm.updated + results.lipas.updated,
    skipped: results.osm.skipped + results.lipas.skipped,
    errors: results.osm.errors.length + results.lipas.errors.length
  }

  console.log(`\nTotal imported: ${totals.imported}`)
  console.log(`Total updated: ${totals.updated}`)
  console.log(`Total skipped: ${totals.skipped}`)
  console.log(`Total errors: ${totals.errors}`)

  if (totals.errors > 0) {
    console.log('\nErrors:')
    ;[...results.osm.errors, ...results.lipas.errors].slice(0, 10).forEach(e => {
      console.log(`  - ${e}`)
    })
    if (totals.errors > 10) {
      console.log(`  ... and ${totals.errors - 10} more`)
    }
  }

  return results
}
