/**
 * Pre-verified Config Seeder
 *
 * Instead of relying on automated discovery (which is "blind" probing),
 * this script creates scraper_configs directly from known data:
 *
 * 1. Probes each municipality's URL patterns in sequence
 * 2. When a working URL is found → creates config from template
 * 3. Optionally tests the config (fetches meetings list)
 * 4. Inserts verified configs as 'active' into scraper_configs
 *
 * Usage:
 *   npx tsx src/services/import/seed-configs.ts [options]
 *
 * Options:
 *   --country FI       Only seed specific country
 *   --dry-run          Don't write to database
 *   --test             Test configs after creation (slower but safer)
 *   --limit 10         Max entities per country
 *   --skip-existing    Skip municipalities that already have a config
 *   --admin-only       Only seed admin entities (regions, counties, states)
 *   --verbose          Show detailed output
 *
 * This is the "get everything working first" approach — after seeding,
 * the system only needs to handle maintenance and self-healing.
 */

import { scraperDb, scraperConfigs } from '../../db/scraper-db.js'
import { eq, and } from 'drizzle-orm'
import { COUNTRY_CONFIGS, type CountryConfig, type UrlPattern } from './discovery/registry-sources.js'
import { getTemplate } from './adaptive/templates.js'
import type { FetcherConfig } from './adaptive/config-schema.js'
import { testConfig } from './adaptive/config-generator.js'
import type { AdminLevel } from './discovery/admin-entities.js'
import { getFiSystem, buildFiUrl, HELSINKI_BODIES } from './discovery/fi-system-map.js'

// ============================================
// Types
// ============================================

interface SeedOptions {
  countries?: string[]
  dryRun?: boolean
  testConfigs?: boolean
  limit?: number
  skipExisting?: boolean
  adminOnly?: boolean
  verbose?: boolean
}

interface SeedResult {
  entity: string
  country: string
  adminLevel: AdminLevel
  systemType: string | null
  url: string | null
  status: 'created' | 'exists' | 'failed' | 'no-match'
  tested?: boolean
  meetingCount?: number
  error?: string
}

// ============================================
// Core: Probe a single URL
// ============================================

async function probeUrl(url: string, confirmPattern?: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Eulesia/1.0 (civic platform; contact@eulesia.eu)' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    })

    if (!response.ok) return false

    const html = await response.text()
    if (html.length < 100) return false

    // If we have a confirm pattern, check for it
    if (confirmPattern) {
      return html.toLowerCase().includes(confirmPattern.toLowerCase())
    }

    return true
  } catch {
    return false
  }
}

// ============================================
// Core: Find working URL for an entity
// ============================================

async function findWorkingUrl(
  slug: string,
  urlPatterns: UrlPattern[],
  verbose = false
): Promise<{ system: string; url: string } | null> {
  for (const pattern of urlPatterns) {
    const url = pattern.buildUrl(slug)
    if (verbose) {
      process.stdout.write(`     Trying ${pattern.system}: ${url} ... `)
    }

    const ok = await probeUrl(url, pattern.confirmPattern)

    if (verbose) {
      console.log(ok ? '✓' : '✗')
    }

    if (ok) {
      return { system: pattern.system, url }
    }

    // Small delay between probes to be polite
    await new Promise(r => setTimeout(r, 200))
  }

  return null
}

// ============================================
// Core: Check if config exists
// ============================================

async function configExists(entityName: string, country: string): Promise<boolean> {
  const existing = await scraperDb
    .select({ id: scraperConfigs.id })
    .from(scraperConfigs)
    .where(
      and(
        eq(scraperConfigs.municipalityName, entityName),
        eq(scraperConfigs.country, country)
      )
    )
    .limit(1)

  return existing.length > 0
}

// ============================================
// Core: Create scraper config
// ============================================

async function createConfig(params: {
  entityName: string
  country: string
  adminLevel: AdminLevel
  systemType: string
  baseUrl: string
  language: string
  config: FetcherConfig
  parentEntity?: string
  dryRun?: boolean
  fetcherOptions?: Record<string, string>
}): Promise<string | null> {
  if (params.dryRun) {
    return 'dry-run-id'
  }

  const [result] = await scraperDb
    .insert(scraperConfigs)
    .values({
      municipalityName: params.entityName,
      entityName: params.entityName,
      adminLevel: params.adminLevel,
      parentEntity: params.parentEntity,
      country: params.country,
      systemType: params.systemType,
      baseUrl: params.baseUrl,
      discoveredBy: 'manual',
      config: params.config,
      configVersion: 1,
      configGeneratedBy: `template:${params.systemType}`,
      status: 'active',
      contentLanguage: params.language,
      fetcherOptions: params.fetcherOptions || undefined,
    })
    .returning({ id: scraperConfigs.id })

  return result.id
}

// ============================================
// Seed municipalities for a country
// ============================================

async function seedCountryMunicipalities(
  config: CountryConfig,
  options: SeedOptions
): Promise<SeedResult[]> {
  const results: SeedResult[] = []
  const municipalities = options.limit
    ? config.municipalities.slice(0, options.limit)
    : config.municipalities

  console.log(`\n  📋 ${config.name} — ${municipalities.length} municipalities`)

  for (let i = 0; i < municipalities.length; i++) {
    const muni = municipalities[i]
    const progress = `[${i + 1}/${municipalities.length}]`

    // Skip existing?
    if (options.skipExisting) {
      const exists = await configExists(muni.name, config.code)
      if (exists) {
        if (options.verbose) console.log(`   ${progress} ${muni.name}: already exists, skipping`)
        results.push({
          entity: muni.name,
          country: config.code,
          adminLevel: 'municipality',
          systemType: null,
          url: null,
          status: 'exists',
        })
        continue
      }
    }

    // Try pre-verified system map first (Finland)
    let match: { system: string; url: string } | null = null

    if (config.code === 'FI') {
      const fiInfo = getFiSystem(muni.slug)
      if (fiInfo) {
        // Skip municipalities marked as having no system
        if (fiInfo.system === 'none') {
          console.log(`   ${progress} ${muni.name}: ⊘ no meeting system (${fiInfo.notes || 'confirmed'})`)
          results.push({
            entity: muni.name,
            country: config.code,
            adminLevel: 'municipality',
            systemType: null,
            url: null,
            status: 'no-match',
          })
          continue
        }

        // Helsinki multi-body: create separate config for each body
        if (fiInfo.system === 'helsinki-paatokset') {
          const hkiTemplate = getTemplate('helsinki-paatokset')
          if (!hkiTemplate) {
            console.log(`   ${progress} ${muni.name}: ✗ no helsinki-paatokset template`)
            continue
          }

          for (const body of HELSINKI_BODIES) {
            const bodyUrl = `https://paatokset.hel.fi/fi/paattajat/${body.slug}/asiakirjat`

            if (options.skipExisting) {
              const exists = await configExists(body.name, config.code)
              if (exists) {
                if (options.verbose) console.log(`     ${body.name}: already exists, skipping`)
                results.push({ entity: body.name, country: config.code, adminLevel: 'municipality', systemType: 'helsinki-paatokset', url: bodyUrl, status: 'exists' })
                continue
              }
            }

            try {
              await createConfig({
                entityName: body.name,
                country: config.code,
                adminLevel: 'municipality',
                systemType: 'helsinki-paatokset',
                baseUrl: bodyUrl,
                language: config.language,
                config: hkiTemplate,
                dryRun: options.dryRun,
              })
              console.log(`   ${progress} ${body.name}: ✓ helsinki-paatokset`)
              results.push({ entity: body.name, country: config.code, adminLevel: 'municipality', systemType: 'helsinki-paatokset', url: bodyUrl, status: 'created' })
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : String(err)
              console.log(`   ${progress} ${body.name}: ✗ ${errMsg}`)
              results.push({ entity: body.name, country: config.code, adminLevel: 'municipality', systemType: 'helsinki-paatokset', url: bodyUrl, status: 'failed', error: errMsg })
            }
          }
          continue
        }

        const url = fiInfo.urlOverride || buildFiUrl(muni.slug, fiInfo.system)

        // Medium confidence entries: verify with a quick probe first
        if (fiInfo.confidence === 'medium') {
          if (options.verbose) console.log(`     Pre-mapped (medium): ${fiInfo.system}, verifying...`)
          const ok = await probeUrl(url, undefined)
          if (ok) {
            match = { system: fiInfo.system, url }
          } else if (options.verbose) {
            console.log(`     Pre-mapped URL failed, falling back to probe`)
          }
        } else {
          // High confidence: trust the mapping
          match = { system: fiInfo.system, url }
          if (options.verbose) console.log(`     Pre-mapped: ${fiInfo.system}`)
        }
      }
    }

    // If no pre-mapped system (or medium-confidence failed), probe URL patterns
    if (!match) {
      match = await findWorkingUrl(muni.slug, config.urlPatterns, options.verbose)
    }

    if (!match) {
      console.log(`   ${progress} ${muni.name}: ✗ no working URL found`)
      results.push({
        entity: muni.name,
        country: config.code,
        adminLevel: 'municipality',
        systemType: null,
        url: null,
        status: 'no-match',
      })
      continue
    }

    // Get template for this system
    const template = getTemplate(match.system)
    if (!template) {
      console.log(`   ${progress} ${muni.name}: ✗ no template for ${match.system}`)
      results.push({
        entity: muni.name,
        country: config.code,
        adminLevel: 'municipality',
        systemType: match.system,
        url: match.url,
        status: 'failed',
        error: `No template for system: ${match.system}`,
      })
      continue
    }

    // Optionally test the config
    let meetingCount: number | undefined
    if (options.testConfigs) {
      const testResult = await testConfig(match.url, template)
      meetingCount = testResult.meetingCount
      if (!testResult.success) {
        console.log(`   ${progress} ${muni.name}: ⚠ ${match.system} found but test failed (${testResult.error})`)
        // Still create the config — self-healer can fix it later
      }
    }

    // Get pathPrefix from FI system map if available
    let fetcherOptions: Record<string, string> | undefined
    if (config.code === 'FI') {
      const fiInfo = getFiSystem(muni.slug)
      if (fiInfo?.pathPrefix) {
        fetcherOptions = { pathPrefix: fiInfo.pathPrefix }
      }
    }

    // Create the config
    try {
      await createConfig({
        entityName: muni.name,
        country: config.code,
        adminLevel: 'municipality',
        systemType: match.system,
        baseUrl: match.url,
        language: config.language,
        config: template,
        dryRun: options.dryRun,
        fetcherOptions,
      })

      const testInfo = meetingCount !== undefined ? ` (${meetingCount} meetings)` : ''
      console.log(`   ${progress} ${muni.name}: ✓ ${match.system}${testInfo}`)

      results.push({
        entity: muni.name,
        country: config.code,
        adminLevel: 'municipality',
        systemType: match.system,
        url: match.url,
        status: 'created',
        tested: options.testConfigs,
        meetingCount,
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.log(`   ${progress} ${muni.name}: ✗ DB error: ${errMsg}`)
      results.push({
        entity: muni.name,
        country: config.code,
        adminLevel: 'municipality',
        systemType: match.system,
        url: match.url,
        status: 'failed',
        error: errMsg,
      })
    }

    // Rate limit between municipalities
    await new Promise(r => setTimeout(r, config.probeDelayMs))
  }

  return results
}

// ============================================
// Seed admin entities for a country
// ============================================

async function seedCountryAdminEntities(
  config: CountryConfig,
  options: SeedOptions
): Promise<SeedResult[]> {
  const results: SeedResult[] = []

  if (!config.adminEntities || !config.adminUrlPatterns) {
    return results
  }

  const entities = options.limit
    ? config.adminEntities.slice(0, options.limit)
    : config.adminEntities

  console.log(`\n  🏛️  ${config.name} — ${entities.length} admin entities`)

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i]
    const progress = `[${i + 1}/${entities.length}]`

    // Skip existing?
    if (options.skipExisting) {
      const exists = await configExists(entity.name, config.code)
      if (exists) {
        if (options.verbose) console.log(`   ${progress} ${entity.name}: already exists, skipping`)
        results.push({
          entity: entity.name,
          country: config.code,
          adminLevel: entity.adminLevel,
          systemType: null,
          url: null,
          status: 'exists',
        })
        continue
      }
    }

    // Get URL patterns for this admin level
    const patterns = config.adminUrlPatterns[entity.adminLevel]
    if (!patterns || patterns.length === 0) {
      console.log(`   ${progress} ${entity.name}: ✗ no URL patterns for ${entity.adminLevel}`)
      results.push({
        entity: entity.name,
        country: config.code,
        adminLevel: entity.adminLevel,
        systemType: null,
        url: null,
        status: 'no-match',
      })
      continue
    }

    // Find working URL
    const match = await findWorkingUrl(entity.slug, patterns, options.verbose)

    if (!match) {
      console.log(`   ${progress} ${entity.name}: ✗ no working URL found`)
      results.push({
        entity: entity.name,
        country: config.code,
        adminLevel: entity.adminLevel,
        systemType: null,
        url: null,
        status: 'no-match',
      })
      continue
    }

    // Get template
    const template = getTemplate(match.system)
    if (!template) {
      console.log(`   ${progress} ${entity.name}: ✗ no template for ${match.system}`)
      results.push({
        entity: entity.name,
        country: config.code,
        adminLevel: entity.adminLevel,
        systemType: match.system,
        url: match.url,
        status: 'failed',
        error: `No template for system: ${match.system}`,
      })
      continue
    }

    // Create config
    try {
      await createConfig({
        entityName: entity.name,
        country: config.code,
        adminLevel: entity.adminLevel,
        systemType: match.system,
        baseUrl: match.url,
        language: config.language,
        config: template,
        parentEntity: entity.parent,
        dryRun: options.dryRun,
      })

      console.log(`   ${progress} ${entity.name}: ✓ ${match.system} (${entity.adminLevel})`)

      results.push({
        entity: entity.name,
        country: config.code,
        adminLevel: entity.adminLevel,
        systemType: match.system,
        url: match.url,
        status: 'created',
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.log(`   ${progress} ${entity.name}: ✗ DB error: ${errMsg}`)
      results.push({
        entity: entity.name,
        country: config.code,
        adminLevel: entity.adminLevel,
        systemType: match.system,
        url: match.url,
        status: 'failed',
        error: errMsg,
      })
    }

    await new Promise(r => setTimeout(r, config.probeDelayMs))
  }

  return results
}

// ============================================
// Special: Estonia bulk seed (all use VOLIS)
// ============================================

async function seedEstoniaBulk(
  config: CountryConfig,
  options: SeedOptions
): Promise<SeedResult[]> {
  const results: SeedResult[] = []
  const municipalities = options.limit
    ? config.municipalities.slice(0, options.limit)
    : config.municipalities

  const template = getTemplate('volis')
  if (!template) {
    console.error('  ✗ No VOLIS template found!')
    return results
  }

  console.log(`\n  📋 Estonia — ${municipalities.length} municipalities (bulk VOLIS)`)

  for (let i = 0; i < municipalities.length; i++) {
    const muni = municipalities[i]
    const progress = `[${i + 1}/${municipalities.length}]`

    if (options.skipExisting) {
      const exists = await configExists(muni.name, 'EE')
      if (exists) {
        results.push({
          entity: muni.name, country: 'EE', adminLevel: 'municipality',
          systemType: 'volis', url: null, status: 'exists',
        })
        continue
      }
    }

    // Estonia: most municipalities use Amphora (atp.amphora.ee/{slug}/)
    // Try multiple slug variants since naming is inconsistent
    const slugBase = muni.slug.replace(/lv$/, '').replace(/vald$/, '')
    const slugVariants = [
      muni.slug,                          // e.g. tallinnlv, sauevald
      slugBase + 'lv',                    // e.g. tallinnlv
      slugBase + 'vald',                  // e.g. sauevald
      slugBase,                           // e.g. tallinn, saue
      slugBase + 'vv',                    // e.g. sauevv (older format)
      slugBase + 'linn',                  // e.g. tallinnlinn
    ]
    // Deduplicate
    const uniqueSlugs = [...new Set(slugVariants)]

    try {
      let foundUrl: string | null = null

      for (const trySlug of uniqueSlugs) {
        const tryUrl = `https://atp.amphora.ee/${trySlug}/`
        const ok = await probeUrl(tryUrl)
        if (ok) {
          foundUrl = tryUrl
          if (options.verbose) console.log(`     Found via slug: ${trySlug}`)
          break
        }
        await new Promise(r => setTimeout(r, 150))
      }

      if (!foundUrl) {
        // Also try delta system as fallback
        const deltaUrl = `https://delta.${slugBase}.ee/`
        const deltaOk = await probeUrl(deltaUrl)
        if (deltaOk) {
          const deltaTemplate = getTemplate('delta')
          if (deltaTemplate) {
            await createConfig({
              entityName: muni.name,
              country: 'EE',
              adminLevel: 'municipality',
              systemType: 'delta',
              baseUrl: deltaUrl,
              language: 'et',
              config: deltaTemplate,
              dryRun: options.dryRun,
            })
            console.log(`   ${progress} ${muni.name}: ✓ delta`)
            results.push({
              entity: muni.name, country: 'EE', adminLevel: 'municipality',
              systemType: 'delta', url: deltaUrl, status: 'created',
            })
            continue
          }
        }

        console.log(`   ${progress} ${muni.name}: ✗ no Amphora/Delta URL found`)
        results.push({
          entity: muni.name, country: 'EE', adminLevel: 'municipality',
          systemType: 'volis', url: `https://atp.amphora.ee/${muni.slug}/`, status: 'no-match',
        })
        continue
      }

      await createConfig({
        entityName: muni.name,
        country: 'EE',
        adminLevel: 'municipality',
        systemType: 'volis',
        baseUrl: foundUrl,
        language: 'et',
        config: template,
        dryRun: options.dryRun,
      })

      console.log(`   ${progress} ${muni.name}: ✓ volis`)
      results.push({
        entity: muni.name, country: 'EE', adminLevel: 'municipality',
        systemType: 'volis', url: foundUrl, status: 'created',
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.log(`   ${progress} ${muni.name}: ✗ ${errMsg}`)
      results.push({
        entity: muni.name, country: 'EE', adminLevel: 'municipality',
        systemType: 'volis', url: `https://atp.amphora.ee/${muni.slug}/`, status: 'failed', error: errMsg,
      })
    }

    await new Promise(r => setTimeout(r, 200))
  }

  return results
}

// ============================================
// Main: Seed all countries
// ============================================

export async function seedConfigs(options: SeedOptions = {}): Promise<{
  total: number
  created: number
  exists: number
  noMatch: number
  failed: number
  byCountry: Record<string, SeedResult[]>
}> {
  const priorityCountries = options.countries || ['FI', 'SE', 'NO', 'DK', 'EE', 'DE']
  const allResults: Record<string, SeedResult[]> = {}

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Eulesia Config Seeder')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  if (options.dryRun) console.log('  ⚠️  DRY RUN — no database writes')
  if (options.testConfigs) console.log('  🧪 Testing configs after creation')
  if (options.skipExisting) console.log('  ⏭️  Skipping existing configs')
  console.log()

  for (const countryCode of priorityCountries) {
    const config = COUNTRY_CONFIGS[countryCode]
    if (!config) {
      console.log(`\n  ⚠️  No config for ${countryCode}`)
      continue
    }

    console.log(`\n🇪🇺 ${config.name} (${config.code})`)
    console.log('─'.repeat(40))

    let results: SeedResult[] = []

    // Municipalities
    if (!options.adminOnly) {
      if (countryCode === 'EE') {
        // Estonia: all VOLIS, bulk mode
        results = await seedEstoniaBulk(config, options)
      } else {
        results = await seedCountryMunicipalities(config, options)
      }
    }

    // Admin entities
    const adminResults = await seedCountryAdminEntities(config, options)
    results = [...results, ...adminResults]

    allResults[countryCode] = results

    // Country summary
    const created = results.filter(r => r.status === 'created').length
    const exists = results.filter(r => r.status === 'exists').length
    const noMatch = results.filter(r => r.status === 'no-match').length
    const failed = results.filter(r => r.status === 'failed').length

    console.log(`\n  Summary: ✓ ${created} created, ⏭ ${exists} existing, ✗ ${noMatch} no URL, ⚠ ${failed} errors`)

    // Show system type breakdown
    const bySys = results
      .filter(r => r.systemType)
      .reduce((acc, r) => {
        acc[r.systemType!] = (acc[r.systemType!] || 0) + 1
        return acc
      }, {} as Record<string, number>)

    if (Object.keys(bySys).length > 0) {
      console.log(`  Systems: ${Object.entries(bySys).map(([k, v]) => `${k}=${v}`).join(', ')}`)
    }
  }

  // Grand total
  const all = Object.values(allResults).flat()
  const totals = {
    total: all.length,
    created: all.filter(r => r.status === 'created').length,
    exists: all.filter(r => r.status === 'exists').length,
    noMatch: all.filter(r => r.status === 'no-match').length,
    failed: all.filter(r => r.status === 'failed').length,
    byCountry: allResults,
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  TOTAL: ${totals.total} entities processed`)
  console.log(`  ✓ ${totals.created} configs created`)
  console.log(`  ⏭ ${totals.exists} already existed`)
  console.log(`  ✗ ${totals.noMatch} no working URL`)
  console.log(`  ⚠ ${totals.failed} errors`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  return totals
}

// ============================================
// CLI Entry Point
// ============================================

async function main() {
  const args = process.argv.slice(2)

  const options: SeedOptions = {
    dryRun: args.includes('--dry-run'),
    testConfigs: args.includes('--test'),
    skipExisting: args.includes('--skip-existing'),
    adminOnly: args.includes('--admin-only'),
    verbose: args.includes('--verbose'),
  }

  // --country FI
  const countryIdx = args.indexOf('--country')
  if (countryIdx !== -1 && args[countryIdx + 1]) {
    options.countries = args[countryIdx + 1].split(',').map(s => s.trim().toUpperCase())
  }

  // --limit 10
  const limitIdx = args.indexOf('--limit')
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    options.limit = parseInt(args[limitIdx + 1], 10)
  }

  try {
    const results = await seedConfigs(options)

    // Write failed entities to a report file for manual review
    const failed = Object.values(results.byCountry)
      .flat()
      .filter(r => r.status === 'no-match' || r.status === 'failed')

    if (failed.length > 0) {
      console.log(`\n📄 ${failed.length} entities need manual attention:`)
      for (const f of failed.slice(0, 20)) {
        console.log(`   ${f.country} | ${f.entity} | ${f.status} | ${f.error || 'no URL found'}`)
      }
      if (failed.length > 20) {
        console.log(`   ... and ${failed.length - 20} more`)
      }
    }
  } catch (err) {
    console.error('Fatal error:', err)
    process.exit(1)
  }

  process.exit(0)
}

// Run if called directly
main()
