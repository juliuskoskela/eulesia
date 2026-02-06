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

import { db, threads, threadTags, users } from '../../db/index.js'
import { eq, and } from 'drizzle-orm'
import { parseFeed, fetchArticleContent, type FeedItem } from './feeds.js'
import { generateEuSummary } from './mistral.js'
import { renderMarkdown } from '../../utils/markdown.js'

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
    institution: 'EUR-Lex',
    feedUrl: 'https://eur-lex.europa.eu/EN/display-feed.html?rssId=1',
    contentType: 'legislation',
    language: 'en'
  },
  {
    institution: 'European Parliament',
    feedUrl: 'https://www.europarl.europa.eu/rss/doc/top-stories/en.xml',
    contentType: 'resolution',
    language: 'en'
  }
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

/**
 * Get or create the system bot user
 */
async function getOrCreateBotUser(): Promise<string> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, 'eulesia-bot'))
    .limit(1)

  if (existing.length > 0) {
    return existing[0].id
  }

  const [botUser] = await db
    .insert(users)
    .values({
      username: 'eulesia-bot',
      name: 'Eulesia Bot',
      email: 'bot@eulesia.eu',
      role: 'institution',
      institutionType: 'agency',
      institutionName: 'Eulesia',
      identityVerified: true,
      identityProvider: 'system',
      identityLevel: 'high'
    })
    .returning({ id: users.id })

  return botUser.id
}

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
          // Get full article content if description is short
          let fullContent = item.description
          if (fullContent.length < 500 && item.link) {
            try {
              fullContent = await fetchArticleContent(item.link)
            } catch {
              // Use feed description as fallback
            }
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

          // Add tags
          const allTags = [...summary.tags, 'eu', source.contentType, source.institution.toLowerCase().split(' ').pop()!]
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
  summary: { summary: string; keyPoints: string[]; discussionPrompt: string },
  item: FeedItem,
  source: EuSource
): string {
  return `${summary.summary}

---

**Keskeiset kohdat:**
${summary.keyPoints.map(p => `- ${p}`).join('\n')}

---

*${summary.discussionPrompt}*

---
🤖 *Tämä on AI-generoitu yhteenveto ${source.institution}n julkaisusta. [Alkuperäinen lähde →](${item.link})*`
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
