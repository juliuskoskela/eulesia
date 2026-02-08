/**
 * Municipal Meeting Minutes Import Service
 *
 * Imports meeting minutes from Finnish municipalities and creates
 * AI-summarized Agora threads for civic discussion.
 *
 * Supported systems:
 * - CloudNC (~24 municipalities + welfare regions)
 * - Dynasty (~40-50 municipalities)
 * - Tweb (~15-20 municipalities)
 *
 * Each system has its own fetcher in ./fetchers/ implementing the
 * MinuteFetcher interface. This module orchestrates the import pipeline.
 *
 * Based on work from github.com/Explories/rautalampi-news
 */

import { db, threads, threadTags, municipalities } from '../../db/index.js'
import { eq, and } from 'drizzle-orm'
import { editorialGate, writeArticle, verifyArticle } from './mistral.js'
import { renderMarkdown } from '../../utils/markdown.js'
import { fetchers, MINUTE_SOURCES } from './fetchers/index.js'
import type { MinuteSource } from './fetchers/index.js'
import { getOrCreateBotUser, getOrCreateInstitution, resolveLocationForMunicipality } from './institutions.js'

// Re-export for backwards compatibility
export { MINUTE_SOURCES }
export type { MinuteSource }

// Rate limiting for AI calls
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================
// IMPORT LOGIC
// ============================================

export interface ImportOptions {
  municipalities?: string[]  // Filter by municipality names
  dryRun?: boolean
  limit?: number  // Max meetings per municipality
}

export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
  threads: { id: string; title: string; municipality: string }[]
}

// Bot user and institution helpers imported from ./institutions.ts

/**
 * Get municipality ID by name, or create if not exists
 */
async function getOrCreateMunicipality(name: string): Promise<string> {
  const normalized = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()

  const existing = await db
    .select({ id: municipalities.id })
    .from(municipalities)
    .where(eq(municipalities.name, normalized))
    .limit(1)

  if (existing.length > 0) {
    return existing[0].id
  }

  const [created] = await db
    .insert(municipalities)
    .values({
      name: normalized,
      nameFi: normalized,
      country: 'FI'
    })
    .returning({ id: municipalities.id })

  return created.id
}

/**
 * Check if meeting has already been imported
 */
async function isAlreadyImported(sourceId: string): Promise<boolean> {
  const existing = await db
    .select({ id: threads.id })
    .from(threads)
    .where(and(
      eq(threads.sourceId, sourceId),
      eq(threads.source, 'minutes_import')
    ))
    .limit(1)

  return existing.length > 0
}

/**
 * Import meeting minutes from configured sources
 */
export async function importMinutes(options: ImportOptions = {}): Promise<ImportResult> {
  const {
    municipalities: filterMunicipalities,
    dryRun = false,
    limit = 5
  } = options

  console.log('📋 Starting municipal minutes import...')
  console.log(`   Dry run: ${dryRun}`)
  console.log(`   Limit per municipality: ${limit}`)

  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
    threads: []
  }

  // Filter sources if specific municipalities requested
  let sources = MINUTE_SOURCES
  if (filterMunicipalities?.length) {
    const filterLower = filterMunicipalities.map(m => m.toLowerCase())
    sources = sources.filter(s => filterLower.includes(s.municipality.toLowerCase()))
  }

  console.log(`   Processing ${sources.length} municipalities`)

  // Get bot user for authorship
  const botUserId = dryRun ? 'dry-run-id' : await getOrCreateBotUser()

  for (const source of sources) {
    console.log(`\n🏛️  ${source.municipality} (${source.type})`)

    // Look up fetcher for this source type
    const fetcher = fetchers[source.type]
    if (!fetcher) {
      console.log(`   ⚠️  ${source.type} not supported`)
      continue
    }

    try {
      // Fetch meeting list via fetcher
      const meetings = await fetcher.fetchMeetings(source)
      console.log(`   Found ${meetings.length} meetings`)

      // Process meetings
      for (const meeting of meetings.slice(0, limit)) {
        const sourceId = `${source.municipality.toLowerCase()}-${meeting.id}`

        // Check if already imported
        if (!dryRun && await isAlreadyImported(sourceId)) {
          console.log(`   ⏭️  Already imported: ${meeting.id}`)
          result.skipped++
          continue
        }

        console.log(`   📄 Processing: ${meeting.title}`)

        if (dryRun) {
          result.imported++
          continue
        }

        try {
          // Extract content via fetcher (handles PDF/HTML per system)
          const originalText = await fetcher.extractContent(meeting, source)
          if (!originalText) {
            result.errors.push(`No content found for ${sourceId}`)
            continue
          }

          // Get municipality ID, institution placeholder, and geographic location
          const municipalityId = await getOrCreateMunicipality(source.municipality)
          const normalizedName = source.municipality.charAt(0).toUpperCase() + source.municipality.slice(1).toLowerCase()
          const sourceInstitutionId = await getOrCreateInstitution(
            normalizedName,
            'municipality',
            { municipalityName: source.municipality }
          )
          const locationId = await resolveLocationForMunicipality(normalizedName)

          // ============================================
          // 3-STAGE AGENTIC PIPELINE
          // ============================================

          // STAGE 1: Editorial Gate — split & filter newsworthy items
          console.log(`   🔍 Stage 1: Editorial gate...`)
          const editorialItems = await editorialGate(
            originalText,
            source.municipality,
            meeting.organ
          )

          const newsworthyItems = editorialItems.filter(item => item.newsworthy)
          const skippedItems = editorialItems.filter(item => !item.newsworthy)

          console.log(`   📊 ${newsworthyItems.length} newsworthy / ${skippedItems.length} filtered out`)

          if (skippedItems.length > 0) {
            console.log(`   ⏭️  Filtered: ${skippedItems.map(i => i.title).join(', ')}`)
          }

          // Construct source URL for article footer
          const sourceUrl = meeting.pageUrl

          // Process each newsworthy item as a separate thread
          for (const item of newsworthyItems) {
            const itemSourceId = `${sourceId}-${item.itemNumber.replace(/\s+/g, '')}`

            if (await isAlreadyImported(itemSourceId)) {
              console.log(`   ⏭️  Already imported: ${item.itemNumber} ${item.title}`)
              result.skipped++
              continue
            }

            try {
              // STAGE 2: Write article from excerpt only
              console.log(`   ✍️  Stage 2: Writing ${item.itemNumber}...`)
              const article = await writeArticle(
                item.excerpt,
                source.municipality,
                item.itemNumber,
                meeting.organ
              )

              // STAGE 3: Verify against original excerpt
              console.log(`   ✓  Stage 3: Verifying ${item.itemNumber}...`)
              const verification = await verifyArticle(
                article,
                item.excerpt,
                source.municipality
              )

              if (!verification.passed && verification.severity === 'major') {
                console.log(`   ⚠️  Verification FAILED for ${item.itemNumber}: ${verification.issues.join('; ')}`)
                result.errors.push(`${itemSourceId}: verification failed — ${verification.issues.join('; ')}`)
                continue
              }

              if (verification.issues.length > 0) {
                console.log(`   ℹ️  Minor issues: ${verification.issues.join('; ')}`)
              }

              // Build thread content
              const content = `${article.summary}

---

**Keskeiset kohdat:**
${article.keyPoints.map(p => `- ${p}`).join('\n')}

---

*${article.discussionPrompt}*

---
🤖 *Tämä on automatisoitu yhteenveto kunnan pöytäkirjasta (${item.itemNumber}). [Näytä alkuperäinen →](${sourceUrl})*`

              const contentHtml = renderMarkdown(content)

              // Create thread
              const [thread] = await db
                .insert(threads)
                .values({
                  title: article.title,
                  content,
                  contentHtml,
                  authorId: botUserId,
                  scope: 'local',
                  municipalityId,
                  locationId,
                  sourceInstitutionId,
                  source: 'minutes_import',
                  sourceUrl,
                  sourceId: itemSourceId,
                  aiGenerated: true,
                  aiModel: 'mistral-large-latest',
                  originalContent: item.excerpt.slice(0, 50000),
                  institutionalContext: {
                    type: 'minutes',
                    meetingId: meeting.id,
                    itemNumber: item.itemNumber,
                    organ: meeting.organ,
                    sourceSystem: source.type,
                    verificationPassed: verification.passed,
                    verificationSeverity: verification.severity,
                    verificationIssues: verification.issues,
                    importedAt: new Date().toISOString()
                  }
                })
                .returning({ id: threads.id })

              // Add tags
              const allTags = [...article.tags, 'pöytäkirja']
              const uniqueTags = [...new Set(allTags)].slice(0, 10)

              for (const tag of uniqueTags) {
                await db.insert(threadTags).values({
                  threadId: thread.id,
                  tag: tag.toLowerCase()
                }).onConflictDoNothing()
              }

              result.imported++
              result.threads.push({
                id: thread.id,
                title: article.title,
                municipality: source.municipality
              })

              console.log(`   ✅ Created: ${article.title}`)

            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err)
              result.errors.push(`${itemSourceId}: ${msg}`)
              console.log(`   ❌ Item error: ${msg}`)
            }

            // Rate limit between AI calls
            await sleep(1000)
          }

        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          result.errors.push(`${sourceId}: ${msg}`)
          console.log(`   ❌ Error: ${msg}`)
        }

        // Rate limit between meetings
        await sleep(1000)
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`${source.municipality}: ${msg}`)
      console.log(`   ❌ Source error: ${msg}`)
    }
  }

  console.log('\n✅ Import complete:')
  console.log(`   Imported: ${result.imported}`)
  console.log(`   Skipped: ${result.skipped}`)
  console.log(`   Errors: ${result.errors.length}`)

  return result
}

/**
 * List available municipalities for import
 */
export function getAvailableMunicipalities(): string[] {
  return MINUTE_SOURCES.map(s => s.municipality)
}
