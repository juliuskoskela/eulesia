/**
 * Ministry Content Import Service
 *
 * Imports government decisions from valtioneuvosto.fi and creates
 * AI-summarized Agora threads for civic discussion.
 *
 * Primary source: valtioneuvosto.fi/paatokset (session-based scraping)
 * - Covers ALL ministries from a single source
 * - ~20-30 decisions per week across 12 ministries
 * - Rich metadata: ministry, minister, reference numbers, PDFs
 *
 * Secondary source: RSS feeds (press releases from individual ministries)
 * - Kept as supplementary for press releases that aren't formal decisions
 */

import { db, threads, threadTags, municipalities } from '../../db/index.js'
import { eq, and } from 'drizzle-orm'
import { parseFeed, fetchArticleContent, type FeedItem } from './feeds.js'
import { generateMinistrySummary } from './mistral.js'
import { renderMarkdown } from '../../utils/markdown.js'
import { fetchRecentSessions, fetchDecision, type VnDecision } from './valtioneuvosto.js'
import { getOrCreateBotUser, getOrCreateInstitution, getInstitutionTopicTag, resolveLocationForMunicipality } from './institutions.js'

// ============================================
// CONFIGURATION
// ============================================

/** RSS sources — kept as supplementary for press releases */
export interface MinistrySource {
  name: string
  feedUrl: string
  contentType: 'press' | 'law' | 'decision'
  language: 'fi' | 'sv' | 'en'
}

export const MINISTRY_SOURCES: MinistrySource[] = [
  {
    name: 'Valtioneuvosto',
    feedUrl: 'https://valtioneuvosto.fi/en/staattiset-feedit-en/-/asset_publisher/LOmkEPY4nk2s/rss',
    contentType: 'press',
    language: 'en'
  },
  {
    name: 'STM',
    feedUrl: 'https://stm.fi/ajankohtaista/-/asset_publisher/QGPfXenrI9A4/rss',
    contentType: 'press',
    language: 'fi'
  }
]

// ============================================
// SHARED HELPERS
// ============================================

export interface ImportOptions {
  sources?: string[]   // Filter by source names
  dryRun?: boolean
  limit?: number       // Max items per source / sessions to check
  skipRss?: boolean    // Skip RSS sources, only fetch VN decisions
  skipVn?: boolean     // Skip VN decisions, only fetch RSS
}

export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
  threads: { id: string; title: string; source: string }[]
}

// Bot user and institution helpers imported from ./institutions.ts

async function isAlreadyImported(sourceId: string): Promise<boolean> {
  const existing = await db
    .select({ id: threads.id })
    .from(threads)
    .where(and(
      eq(threads.sourceId, sourceId),
      eq(threads.source, 'rss_import')
    ))
    .limit(1)

  return existing.length > 0
}

// ============================================
// MAIN IMPORT: valtioneuvosto.fi decisions
// ============================================

/**
 * Import government decisions from valtioneuvosto.fi sessions.
 * This is the primary import source — covers all 12 ministries.
 */
async function importVnDecisions(
  botUserId: string,
  result: ImportResult,
  options: { dryRun: boolean; limit: number }
): Promise<void> {
  const { dryRun, limit } = options

  console.log('\n🏛️  Valtioneuvosto.fi — päätökset')
  console.log(`   Fetching last ${limit} sessions...`)

  const sessions = await fetchRecentSessions(limit)
  console.log(`   Found ${sessions.length} sessions`)

  for (const session of sessions) {
    console.log(`\n📋 ${session.title} (${session.decisions.length} päätöstä)`)

    for (const decLink of session.decisions) {
      const sourceId = `vn-decision-${decLink.decisionId}`

      if (!dryRun && await isAlreadyImported(sourceId)) {
        result.skipped++
        continue
      }

      console.log(`   📄 ${decLink.ministry}: ${decLink.title.slice(0, 60)}`)

      if (dryRun) {
        result.imported++
        continue
      }

      try {
        // Fetch full decision content
        const decision = await fetchDecision(decLink.decisionId, decLink.ministry)
        if (!decision || !decision.content || decision.content.length < 30) {
          result.errors.push(`${sourceId}: No content extracted`)
          continue
        }

        // Build original text for AI processing
        const originalText = [
          `Ministeriö: ${decision.ministry}`,
          decision.minister ? `Ministeri: ${decision.minister}` : '',
          decision.reference ? `Viite: ${decision.reference}` : '',
          `Istunto: ${decision.sessionType} ${decision.sessionDate}`,
          '',
          decision.content
        ].filter(Boolean).join('\n')

        // Generate AI summary
        const summary = await generateMinistrySummary(
          originalText,
          decision.ministry || 'Valtioneuvosto',
          'decision'
        )

        // Build thread content
        const content = buildVnThreadContent(summary, decision)
        const contentHtml = renderMarkdown(content)

        // Get or create source institution placeholder
        const institutionName = decision.ministry || 'Valtioneuvosto'
        const sourceInstitutionId = await getOrCreateInstitution(institutionName, 'ministry')
        const topicTag = await getInstitutionTopicTag(sourceInstitutionId)

        // Resolve scope and location for regional decisions
        const threadScope = summary.scope || 'national'
        let municipalityId: string | undefined
        let locationId: string | null = null

        if (threadScope === 'local' && summary.region) {
          console.log(`   📍 Regional decision: ${summary.region}`)
          // Try to resolve region to municipality and location
          locationId = await resolveLocationForMunicipality(summary.region)
          const normalized = summary.region.charAt(0).toUpperCase() + summary.region.slice(1).toLowerCase()
          const [muni] = await db
            .select({ id: municipalities.id })
            .from(municipalities)
            .where(eq(municipalities.name, normalized))
            .limit(1)
          municipalityId = muni?.id
        }

        // Create thread
        const [thread] = await db
          .insert(threads)
          .values({
            title: summary.title,
            content,
            contentHtml,
            authorId: botUserId,
            scope: threadScope,
            municipalityId,
            locationId,
            source: 'rss_import',
            sourceUrl: decision.sourceUrl,
            sourceId,
            sourceInstitutionId,
            aiGenerated: true,
            aiModel: process.env.MISTRAL_MODEL || 'mistral-small-latest',
            originalContent: originalText.slice(0, 50000),
            institutionalContext: {
              type: 'decision',
              institution: institutionName,
              ministry: decision.ministry,
              minister: decision.minister,
              reference: decision.reference,
              sessionType: decision.sessionType,
              sessionDate: decision.sessionDate,
              decisionId: decision.decisionId,
              region: summary.region,
              publishedAt: parseFinDate(decision.sessionDate)?.toISOString() || new Date().toISOString(),
              importedAt: new Date().toISOString()
            }
          })
          .returning({ id: threads.id })

        // Add tags
        const allTags = [...summary.tags, 'päätös', institutionName.toLowerCase()]
        if (topicTag) allTags.push(topicTag)
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
          title: summary.title,
          source: institutionName
        })

        console.log(`   ✅ ${summary.title}`)

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        result.errors.push(`${sourceId}: ${msg}`)
        console.log(`   ❌ ${msg}`)
      }

      // Rate limit between AI calls
      await new Promise(r => setTimeout(r, 1000))
    }
  }
}

function buildVnThreadContent(
  summary: { summary: string; keyPoints: string[] },
  decision: VnDecision
): string {
  const meta = [
    decision.ministry ? `**Ministeriö:** ${decision.ministry}` : '',
    decision.minister ? `**Ministeri:** ${decision.minister}` : '',
    decision.reference ? `**Viite:** ${decision.reference}` : '',
    decision.sessionType ? `**Istunto:** ${decision.sessionType} ${decision.sessionDate}` : ''
  ].filter(Boolean).join('\n')

  return `${summary.summary}

---

${meta}

**Keskeiset kohdat:**
${summary.keyPoints.map(p => `- ${p}`).join('\n')}

---
*Eulesia summary — Generated with [Mistral AI](https://mistral.ai). [Alkuperäinen päätös →](${decision.sourceUrl})*`
}

/** Parse Finnish date format "5.2.2026" to Date */
function parseFinDate(dateStr: string): Date | null {
  const match = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (!match) return null
  return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]))
}

// ============================================
// SECONDARY: RSS feed import
// ============================================

async function importRssFeeds(
  botUserId: string,
  result: ImportResult,
  options: { dryRun: boolean; limit: number; filterSources?: string[] }
): Promise<void> {
  const { dryRun, limit, filterSources } = options

  let sources = MINISTRY_SOURCES
  if (filterSources?.length) {
    const filterLower = filterSources.map(s => s.toLowerCase())
    sources = sources.filter(s => filterLower.includes(s.name.toLowerCase()))
  }

  for (const source of sources) {
    console.log(`\n📰 RSS: ${source.name} (${source.contentType})`)

    try {
      const feed = await parseFeed(source.feedUrl, limit)
      console.log(`   Feed: ${feed.title} — ${feed.items.length} items`)

      // Filter out items older than 30 days
      const maxAge = 30 * 24 * 60 * 60 * 1000
      const cutoff = new Date(Date.now() - maxAge)
      const recentItems = feed.items.filter(item => item.pubDate >= cutoff)
      const oldItems = feed.items.length - recentItems.length
      if (oldItems > 0) {
        console.log(`   ⏭️  Filtered out ${oldItems} items older than 30 days`)
      }

      for (const item of recentItems) {
        const sourceId = `ministry-${source.name.toLowerCase()}-${hashId(item.id)}`

        if (!dryRun && await isAlreadyImported(sourceId)) {
          result.skipped++
          continue
        }

        console.log(`   📄 ${item.title.slice(0, 60)}`)

        if (dryRun) {
          result.imported++
          continue
        }

        try {
          let fullContent = item.description
          if (fullContent.length < 500 && item.link) {
            try {
              fullContent = await fetchArticleContent(item.link)
            } catch {
              // Use feed description as fallback
            }
          }

          const summary = await generateMinistrySummary(
            fullContent,
            source.name,
            source.contentType
          )

          const content = buildRssThreadContent(summary, item, source)
          const contentHtml = renderMarkdown(content)

          const sourceInstitutionId = await getOrCreateInstitution(source.name, 'ministry')
          const topicTag = await getInstitutionTopicTag(sourceInstitutionId)

          // Resolve scope for regional content
          const rssScope = summary.scope || 'national'
          let rssMunicipalityId: string | undefined
          let rssLocationId: string | null = null
          if (rssScope === 'local' && summary.region) {
            rssLocationId = await resolveLocationForMunicipality(summary.region)
            const normalized = summary.region.charAt(0).toUpperCase() + summary.region.slice(1).toLowerCase()
            const [muni] = await db
              .select({ id: municipalities.id })
              .from(municipalities)
              .where(eq(municipalities.name, normalized))
              .limit(1)
            rssMunicipalityId = muni?.id
          }

          const [thread] = await db
            .insert(threads)
            .values({
              title: summary.title,
              content,
              contentHtml,
              authorId: botUserId,
              scope: rssScope,
              municipalityId: rssMunicipalityId,
              locationId: rssLocationId,
              source: 'rss_import',
              sourceUrl: item.link,
              sourceId,
              sourceInstitutionId,
              aiGenerated: true,
              aiModel: process.env.MISTRAL_MODEL || 'mistral-small-latest',
              originalContent: fullContent.slice(0, 50000),
              institutionalContext: {
                type: source.contentType,
                institution: source.name,
                feedUrl: source.feedUrl,
                publishedAt: item.pubDate.toISOString(),
                importedAt: new Date().toISOString()
              }
            })
            .returning({ id: threads.id })

          const allTags = [...summary.tags, source.contentType, source.name.toLowerCase()]
          if (topicTag) allTags.push(topicTag)
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
            title: summary.title,
            source: source.name
          })

          console.log(`   ✅ ${summary.title}`)

        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          result.errors.push(`${sourceId}: ${msg}`)
          console.log(`   ❌ ${msg}`)
        }

        await new Promise(r => setTimeout(r, 1000))
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`${source.name}: ${msg}`)
      console.log(`   ❌ Source error: ${msg}`)
    }
  }
}

function buildRssThreadContent(
  summary: { summary: string; keyPoints: string[] },
  item: FeedItem,
  _source: MinistrySource
): string {
  return `${summary.summary}

---

**Keskeiset kohdat:**
${summary.keyPoints.map(p => `- ${p}`).join('\n')}

---
*Eulesia summary — Generated with [Mistral AI](https://mistral.ai). [Alkuperäinen lähde →](${item.link})*`
}

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * Import content from Finnish ministry and government sources.
 * Primary: valtioneuvosto.fi decisions (all ministries)
 * Secondary: RSS feeds (press releases)
 */
export async function importMinistryContent(options: ImportOptions = {}): Promise<ImportResult> {
  const {
    sources: filterSources,
    dryRun = false,
    limit = 5,
    skipRss = false,
    skipVn = false
  } = options

  console.log('🏛️ Starting ministry content import...')
  console.log(`   Dry run: ${dryRun}`)
  console.log(`   VN sessions: ${skipVn ? 'SKIP' : limit}`)
  console.log(`   RSS feeds: ${skipRss ? 'SKIP' : 'enabled'}`)

  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
    threads: []
  }

  const botUserId = dryRun ? 'dry-run-id' : await getOrCreateBotUser()

  // Primary: valtioneuvosto.fi decisions
  if (!skipVn) {
    try {
      await importVnDecisions(botUserId, result, { dryRun, limit })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`VN decisions: ${msg}`)
      console.log(`\n❌ VN decisions error: ${msg}`)
    }
  }

  // Secondary: RSS feeds
  if (!skipRss) {
    try {
      await importRssFeeds(botUserId, result, { dryRun, limit: 10, filterSources })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`RSS feeds: ${msg}`)
      console.log(`\n❌ RSS error: ${msg}`)
    }
  }

  console.log('\n✅ Ministry import complete:')
  console.log(`   Imported: ${result.imported}`)
  console.log(`   Skipped: ${result.skipped}`)
  console.log(`   Errors: ${result.errors.length}`)

  return result
}

// ============================================
// CLEANUP
// ============================================

/**
 * Remove old ministry-imported threads where the original content
 * was published before the given cutoff date.
 */
export async function cleanOldMinistryThreads(options: { dryRun?: boolean; cutoffDate?: Date } = {}): Promise<number> {
  const { dryRun = false, cutoffDate = new Date('2025-01-01') } = options

  console.log(`🧹 Cleaning ministry threads published before ${cutoffDate.toISOString().slice(0, 10)}...`)
  console.log(`   Dry run: ${dryRun}`)

  const oldThreads = await db
    .select({ id: threads.id, title: threads.title, sourceId: threads.sourceId, context: threads.institutionalContext })
    .from(threads)
    .where(eq(threads.source, 'rss_import'))

  const toDelete = oldThreads.filter(t => {
    const ctx = t.context as { publishedAt?: string } | null
    if (!ctx?.publishedAt) return false
    return new Date(ctx.publishedAt) < cutoffDate
  })

  console.log(`   Found ${toDelete.length} threads to remove (of ${oldThreads.length} total rss_import threads)`)

  if (dryRun) {
    for (const t of toDelete) {
      const ctx = t.context as { publishedAt?: string } | null
      console.log(`   🗑️  Would delete: ${t.title?.slice(0, 60)} (${ctx?.publishedAt?.slice(0, 10)})`)
    }
    return toDelete.length
  }

  for (const t of toDelete) {
    await db.delete(threadTags).where(eq(threadTags.threadId, t.id))
    await db.delete(threads).where(eq(threads.id, t.id))
    const ctx = t.context as { publishedAt?: string } | null
    console.log(`   🗑️  Deleted: ${t.title?.slice(0, 60)} (${ctx?.publishedAt?.slice(0, 10)})`)
  }

  console.log(`\n✅ Cleaned ${toDelete.length} old threads`)
  return toDelete.length
}

// ============================================
// UTILS
// ============================================

function hashId(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}
