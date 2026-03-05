/**
 * EU Content Import Service
 *
 * Imports press releases, legislation summaries, and decisions from
 * EU institutions and creates AI-summarized Agora threads
 * for civic discussion in Finnish.
 *
 * Sources:
 * - European Commission press releases
 * - EUR-Lex recent legislation
 * - European Parliament
 */

import { db, threads, threadTags } from '../../db/index.js'
import { eq, and } from 'drizzle-orm'
import { parseFeed, type FeedItem } from './feeds.js'
import { generateEuSummary } from './mistral.js'
import { renderMarkdown } from '../../utils/markdown.js'
import { getOrCreateBotUser, getOrCreateInstitution, getInstitutionTopicTag } from './institutions.js'

// ============================================
// EU SOURCE CONFIGURATION
// ============================================

export interface EuSource {
  institution: string
  feedUrl: string
  contentType: 'press' | 'legislation' | 'resolution'
  language: 'en' | 'fi'
}

export const EU_SOURCES: EuSource[] = [
  {
    institution: 'European Commission',
    feedUrl: 'https://ec.europa.eu/commission/presscorner/api/rss?language=en',
    contentType: 'press',
    language: 'en'
  },
  {
    institution: 'European Parliament',
    feedUrl: 'https://www.europarl.europa.eu/rss/doc/top-stories/en.xml',
    contentType: 'resolution',
    language: 'en'
  }
  // EUR-Lex RSS not currently available — add when working feed URL found
]

// ============================================
// IMPORT LOGIC
// ============================================

export interface ImportOptions {
  sources?: string[]   // Filter by institution names
  dryRun?: boolean
  limit?: number       // Max items per source
}

export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
  threads: { id: string; title: string; source: string }[]
}

// Bot user and institution helpers imported from ./institutions.ts

/**
 * Check if content has already been imported
 */
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

/**
 * Import content from EU institutions
 */
export async function importEuContent(options: ImportOptions = {}): Promise<ImportResult> {
  const {
    sources: filterSources,
    dryRun = false,
    limit = 10
  } = options

  console.log('🇪🇺 Starting EU content import...')
  console.log(`   Dry run: ${dryRun}`)
  console.log(`   Limit per source: ${limit}`)

  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
    threads: []
  }

  let sources = EU_SOURCES
  if (filterSources?.length) {
    const filterLower = filterSources.map(s => s.toLowerCase())
    sources = sources.filter(s => filterLower.includes(s.institution.toLowerCase()))
  }

  console.log(`   Processing ${sources.length} sources`)

  const botUserId = dryRun ? 'dry-run-id' : await getOrCreateBotUser()

  for (const source of sources) {
    console.log(`\n🇪🇺 ${source.institution} (${source.contentType})`)

    try {
      const feed = await parseFeed(source.feedUrl, limit)
      console.log(`   Feed: ${feed.title} — ${feed.items.length} items`)

      for (const item of feed.items) {
        const sourceId = `eu-${source.institution.toLowerCase().replace(/\s+/g, '-')}-${hashId(item.id)}`

        if (!dryRun && await isAlreadyImported(sourceId)) {
          console.log(`   ⏭️  Already imported: ${item.title.slice(0, 50)}`)
          result.skipped++
          continue
        }

        console.log(`   📄 Processing: ${item.title.slice(0, 60)}`)

        if (dryRun) {
          result.imported++
          continue
        }

        try {
          // Build content for AI summarization.
          // EU presscorner is a SPA — fetching the HTML page returns only
          // navigation chrome and breadcrumbs, not the actual article.
          // Always try the presscorner JSON API first for full content.
          let fullContent = item.description

          // Try presscorner API for full article content (works for EC press releases)
          if (item.link && item.link.includes('presscorner')) {
            const apiContent = await fetchPresscornerContent(item.link, item.id)
            if (apiContent) {
              fullContent = apiContent
              console.log(`   ✅ Using presscorner API content (${fullContent.length} chars)`)
            }
          }

          // If we still only have the short RSS description, enrich it
          if (fullContent.length < 500) {
            const enriched = [`Title: ${item.title}`]
            if (item.categories?.length) enriched.push(`Categories: ${item.categories.join(', ')}`)
            enriched.push(`\n${fullContent}`)
            fullContent = enriched.join('\n')
            console.log(`   ℹ️  Using enriched feed description (${fullContent.length} chars)`)
          }

          // Quality gate: skip items where we only have garbage content
          if (isLowQualityContent(fullContent)) {
            console.log(`   ⏭️  Skipping low-quality content: ${item.title.slice(0, 50)}`)
            result.skipped++
            continue
          }

          // Generate AI summary (English → Finnish)
          const summary = await generateEuSummary(
            fullContent,
            source.institution,
            source.contentType
          )

          // Build thread content
          const content = buildThreadContent(summary, item, source)
          const contentHtml = renderMarkdown(content)

          // Get or create source institution placeholder
          const sourceInstitutionId = await getOrCreateInstitution(source.institution, 'agency')
          const topicTag = await getInstitutionTopicTag(sourceInstitutionId)

          // Create thread
          const [thread] = await db
            .insert(threads)
            .values({
              title: summary.title,
              content,
              contentHtml,
              authorId: botUserId,
              scope: 'european',
              source: 'rss_import',
              sourceUrl: item.link,
              sourceId,
              sourceInstitutionId,
              aiGenerated: true,
              aiModel: 'mistral-large-latest',
              originalContent: fullContent.slice(0, 50000),
              institutionalContext: {
                type: source.contentType,
                institution: source.institution,
                feedUrl: source.feedUrl,
                originalLanguage: source.language,
                publishedAt: item.pubDate.toISOString(),
                importedAt: new Date().toISOString()
              }
            })
            .returning({ id: threads.id })

          // Add tags (include institution topic tag if available)
          const allTags = [...summary.tags, 'eu', source.contentType, source.institution.toLowerCase().split(' ').pop()!]
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
            source: source.institution
          })

          console.log(`   ✅ Created thread: ${summary.title}`)

        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          result.errors.push(`${sourceId}: ${msg}`)
          console.log(`   ❌ Error: ${msg}`)
        }

        // Rate limit between items
        await new Promise(r => setTimeout(r, 1000))
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`${source.institution}: ${msg}`)
      console.log(`   ❌ Source error: ${msg}`)
    }
  }

  console.log('\n✅ EU import complete:')
  console.log(`   Imported: ${result.imported}`)
  console.log(`   Skipped: ${result.skipped}`)
  console.log(`   Errors: ${result.errors.length}`)

  return result
}

function buildThreadContent(
  summary: { summary: string; keyPoints: string[] },
  item: FeedItem,
  _source: EuSource
): string {
  return `${summary.summary}

<div class="summary-keypoints">

**Keskeiset kohdat:**
${summary.keyPoints.map(p => `- ${p}`).join('\n')}

</div>

<div class="summary-footer">

*Eulesia summary — Generated with [Mistral AI](https://mistral.ai). [Alkuperäinen lähde →](${item.link})*

</div>`
}

/**
 * Fetch full text content from EU presscorner via their JSON API.
 *
 * The presscorner website is a SPA (client-side rendered) so regular HTML
 * fetching only returns navigation chrome. Instead we use the presscorner
 * documents API which returns full article content as HTML.
 *
 * API: https://ec.europa.eu/commission/presscorner/api/documents?reference=IP/26/433&language=en
 * Returns: { docuLanguageResource: { title, htmlContent, ... } }
 */
async function fetchPresscornerContent(link: string, guid: string): Promise<string | null> {
  // Extract reference from guid or link URL:
  // "https://ec.europa.eu/commission/presscorner/detail/en/ip_26_433" → "ip_26_433"
  // "https://ec.europa.eu/commission/presscorner/detail/en/speech_26_435" → "speech_26_435"
  const refMatch = (guid || link).match(/([a-z]+_\d+_\d+)/i)
  if (!refMatch) return null

  // Convert underscore format (ip_26_433) to API format (IP/26/433)
  const refParts = refMatch[1].toUpperCase().split('_')
  if (refParts.length < 3) return null
  const apiRef = `${refParts[0]}/${refParts.slice(1).join('/')}`

  const apiUrl = `https://ec.europa.eu/commission/presscorner/api/documents?reference=${apiRef}&language=en`

  try {
    // Rate limit
    await new Promise(r => setTimeout(r, 2000))

    console.log(`   🔍 Fetching presscorner API: ${apiRef}`)

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Eulesia/1.0 (civic platform; contact@eulesia.eu)',
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      console.log(`   ⚠️  Presscorner API returned ${response.status} for ${apiRef}`)
      return null
    }

    const data = await response.json() as {
      docuLanguageResource?: {
        title?: string
        subtitle?: string
        htmlContent?: string
      }
    }

    const resource = data.docuLanguageResource
    if (!resource?.htmlContent) {
      console.log(`   ⚠️  No htmlContent in presscorner API response for ${apiRef}`)
      return null
    }

    // Strip HTML tags to get plain text for AI summarization
    const plainText = resource.htmlContent
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, num: string) => String.fromCharCode(parseInt(num)))
      .replace(/\s+/g, ' ')
      .trim()

    if (plainText.length < 100) {
      console.log(`   ⚠️  Presscorner content too short (${plainText.length} chars) for ${apiRef}`)
      return null
    }

    console.log(`   ✅ Got ${plainText.length} chars from presscorner API for ${apiRef}`)
    return plainText.slice(0, 30000)
  } catch (err) {
    console.log(`   ⚠️  Presscorner API error for ${apiRef}: ${err instanceof Error ? err.message : err}`)
    return null
  }
}

/**
 * Check if content looks like garbage (navigation text, breadcrumbs, etc.)
 * rather than actual article content.
 */
function isLowQualityContent(text: string): boolean {
  // Too short to be useful
  if (text.length < 100) return true

  // Check for signs of navigation/SPA garbage
  const garbageIndicators = [
    // Navigation/breadcrumbs concatenated without spaces
    /commission\s*eu\s*kansalais/i,
    /press\s*suomi\s*tiedot/i,
    // Mostly non-word characters
    /^[\s\W]{50,}/,
    // Repeated menu items
    /(menu|nav|footer|cookie|sidebar)/gi
  ]

  const matchCount = garbageIndicators.filter(pattern => pattern.test(text)).length
  if (matchCount >= 2) return true

  // Check word quality: real content has proper words
  const words = text.split(/\s+/).filter(w => w.length > 2)
  if (words.length < 20) return true

  // Check if it's mostly gibberish (no proper sentences)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10)
  if (sentences.length < 2) return true

  return false
}

/**
 * Create a short hash from a string for sourceId
 */
function hashId(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}
