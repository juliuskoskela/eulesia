/**
 * Municipal Meeting Minutes Import Service
 *
 * Imports meeting minutes from Finnish municipalities and creates
 * AI-summarized Agora threads for civic discussion.
 *
 * Supported systems:
 * - CloudNC (most common)
 * - Tweb
 * - Dynasty
 *
 * Based on work from github.com/Explories/rautalampi-news
 */

import { db, threads, threadTags, municipalities, users } from '../../db/index.js'
import { eq, and } from 'drizzle-orm'
import { generateMinutesSummary } from './mistral.js'
// splitMinutesIntoItems available for future use when processing full meetings
import { renderMarkdown } from '../../utils/markdown.js'

// Rate limiting
const RATE_LIMIT_MS = 2000
let lastRequestTime = 0

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - timeSinceLastRequest)
  }
  lastRequestTime = Date.now()
  return fetch(url)
}

// ============================================
// MINUTES SOURCE CONFIGURATION
// ============================================

export interface MinuteSource {
  municipality: string
  type: 'cloudnc' | 'tweb' | 'dynasty' | 'pdf'
  url: string
}

// CloudNC municipalities
export const CLOUDNC_SOURCES: MinuteSource[] = [
  'rautalampi', 'tampere', 'jyvaskyla', 'mikkeli', 'rovaniemi',
  'kajaani', 'pori', 'hollola', 'tuusula', 'jarvenpaa'
].map(m => ({
  municipality: m.charAt(0).toUpperCase() + m.slice(1),
  type: 'cloudnc' as const,
  url: `https://${m}.cloudnc.fi/fi-FI`
}))

// All sources combined
export const MINUTE_SOURCES: MinuteSource[] = [
  ...CLOUDNC_SOURCES
  // Add TWEB_SOURCES, DYNASTY_SOURCES later
]

// ============================================
// MEETING LISTING FETCHERS
// ============================================

interface Meeting {
  id: string
  pageUrl: string
  title: string
  date?: string
  organ?: string  // e.g., "Kunnanhallitus", "Valtuusto"
}

/**
 * Fetch meeting list from CloudNC system
 */
async function fetchCloudNCMeetings(baseUrl: string): Promise<Meeting[]> {
  const response = await rateLimitedFetch(baseUrl)
  const html = await response.text()

  const meetings: Meeting[] = []

  // CloudNC pattern: href='/fi-FI/Toimielimet/Organ/Kokous_DATE'
  // Match: Organ - Kokous DATE Pöytäkirja (skip Esityslista)
  const regex = /href='([^']*\/Kokous_[^']+)'[^>]*>([^<]+Pöytäkirja)/gi
  let match

  while ((match = regex.exec(html)) !== null) {
    const href = match[1]
    const title = match[2].trim()

    // Extract organ and date from title
    const parts = title.split(' - ')
    const organ = parts[0]?.trim()

    // Create unique ID from path
    const pathParts = href.split('/')
    const id = pathParts[pathParts.length - 1]  // e.g., "Kokous_1912026"

    meetings.push({
      id,
      pageUrl: new URL(href, baseUrl).toString(),
      title,
      organ
    })
  }

  console.log(`   Found ${meetings.length} pöytäkirjat`)
  return meetings.slice(0, 10)  // Limit to 10 most recent
}

/**
 * Extract PDF URL from CloudNC meeting page
 */
async function extractCloudNCPdfUrl(pageUrl: string): Promise<string | null> {
  const response = await rateLimitedFetch(pageUrl)
  const html = await response.text()

  // Look for download button with /download/noname/ pattern
  // Pattern: href="/download/noname/{GUID}/ID"
  const pdfMatch = html.match(/href="(\/download\/noname\/\{[^}]+\}\/\d+)"/i)
  if (pdfMatch) {
    const baseUrl = new URL(pageUrl)
    return `${baseUrl.origin}${pdfMatch[1]}`
  }

  return null
}

/**
 * Download and extract text from PDF using pdf-parse
 */
async function extractTextFromPdf(pdfUrl: string): Promise<string> {
  console.log(`   Downloading PDF: ${pdfUrl}`)

  const response = await rateLimitedFetch(pdfUrl)
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Dynamic import for pdf-parse (CommonJS module)
  const pdfParse = (await import('pdf-parse')).default
  const data = await pdfParse(buffer)

  console.log(`   Extracted ${data.text.length} characters from PDF`)
  return data.text
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

/**
 * Get or create the system bot user for AI-generated content
 */
async function getOrCreateBotUser(): Promise<string> {
  // Check if bot user exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, 'eulesia-bot'))
    .limit(1)

  if (existing.length > 0) {
    return existing[0].id
  }

  // Create bot user
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

    try {
      // Fetch meeting list
      let meetings: Meeting[] = []

      if (source.type === 'cloudnc') {
        meetings = await fetchCloudNCMeetings(source.url)
      } else {
        console.log(`   ⚠️  ${source.type} not yet implemented`)
        continue
      }

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
          // Get PDF URL
          const pdfUrl = await extractCloudNCPdfUrl(meeting.pageUrl)
          if (!pdfUrl) {
            result.errors.push(`No PDF found for ${sourceId}`)
            continue
          }

          // Extract text from PDF
          let originalText: string
          try {
            originalText = await extractTextFromPdf(pdfUrl)
          } catch (err) {
            // For now, skip PDF parsing (requires library)
            result.errors.push(`PDF parsing not available: ${sourceId}`)
            continue
          }

          // Generate AI summary
          const summary = await generateMinutesSummary(
            originalText,
            source.municipality,
            meeting.organ
          )

          // Get municipality ID
          const municipalityId = await getOrCreateMunicipality(source.municipality)

          // Build thread content
          const content = `${summary.summary}

---

**Keskeiset kohdat:**
${summary.keyPoints.map(p => `- ${p}`).join('\n')}

---

*${summary.discussionPrompt}*

---
🤖 *Tämä on AI-generoitu yhteenveto kunnan pöytäkirjasta. [Näytä alkuperäinen →](${pdfUrl})*`

          const contentHtml = renderMarkdown(content)

          // Create thread
          const [thread] = await db
            .insert(threads)
            .values({
              title: summary.title,
              content,
              contentHtml,
              authorId: botUserId,
              scope: 'municipal',
              municipalityId,
              source: 'minutes_import',
              sourceUrl: pdfUrl,
              sourceId,
              aiGenerated: true,
              aiModel: 'mistral-large-3-25-12',
              originalContent: originalText.slice(0, 50000),  // Store first 50k chars
              institutionalContext: {
                type: 'minutes',
                meetingId: meeting.id,
                organ: meeting.organ,
                sourceSystem: source.type,
                importedAt: new Date().toISOString()
              }
            })
            .returning({ id: threads.id })

          // Add tags
          const allTags = [...summary.tags, 'pöytäkirja', source.municipality.toLowerCase()]
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
            municipality: source.municipality
          })

          console.log(`   ✅ Created thread: ${summary.title}`)

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
